import { Router } from "express";
import { prisma, withTx } from "../db";
import { Prisma } from "../generated/prisma/client";
import { logAudit } from "../middleware/audit";
import { asyncHandler, badRequest, ApiError } from "../middleware/error";
import { requireRole } from "../middleware/auth";
import { nextDocNumber } from "../services/numbering";
import { maybeRequestApproval } from "../services/approval";
import { postPurchaseInvoice, postSupplierPayment } from "../services/posting";

export const purchaseRouter = Router();
const MODULE = "Purchase";

// ── Purchase orders ──

purchaseRouter.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (req.query.status) where.status = String(req.query.status) as never;
    if (req.query.supplierId) where.supplierId = Number(req.query.supplierId);
    res.json(
      await prisma.purchaseOrder.findMany({
        where,
        include: { supplier: true, items: { include: { product: true } } },
        orderBy: { orderDate: "desc" },
      }),
    );
  }),
);

// Pending POs = awaiting approval or approved-but-not-fully-received.
purchaseRouter.get(
  "/orders/pending",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.purchaseOrder.findMany({
        where: { status: { in: ["PENDING", "APPROVED", "PARTIAL", "OVERDUE"] } },
        include: { supplier: true, items: { include: { product: true } } },
        orderBy: { expectedDate: "asc" },
      }),
    );
  }),
);

purchaseRouter.get(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: Number(req.params.id) },
      include: { supplier: true, items: { include: { product: { include: { unit: true } } } }, purchaseInvoices: true },
    });
    if (!order) throw new ApiError(404, "Purchase order not found");
    res.json(order);
  }),
);

purchaseRouter.post(
  "/orders",
  requireRole("ADMIN", "MANAGER", "STAFF"),
  asyncHandler(async (req, res) => {
    const { supplierId, orderDate, expectedDate, notes, items } = req.body ?? {};
    if (!supplierId || !Array.isArray(items) || items.length === 0) {
      badRequest("supplierId and items[] are required");
    }

    const order = await withTx(async (tx) => {
      const poNo = await nextDocNumber(tx, "purchase_order", "PO");
      let subtotal = new Prisma.Decimal(0);
      let taxTotal = new Prisma.Decimal(0);
      const lineData = [] as Prisma.PurchaseOrderItemCreateWithoutOrderInput[];
      for (const item of items) {
        const qty = new Prisma.Decimal(item.quantity);
        const rate = new Prisma.Decimal(item.rate);
        const lineNet = qty.mul(rate);
        let tax = new Prisma.Decimal(0);
        if (item.taxRateId) {
          const taxRate = await tx.taxRate.findUniqueOrThrow({ where: { id: Number(item.taxRateId) } });
          tax = lineNet.mul(taxRate.ratePercent).div(100);
        }
        subtotal = subtotal.plus(lineNet);
        taxTotal = taxTotal.plus(tax);
        lineData.push({
          product: { connect: { id: Number(item.productId) } },
          quantity: qty,
          rate,
          taxRate: item.taxRateId ? { connect: { id: Number(item.taxRateId) } } : undefined,
          taxAmount: tax,
          total: lineNet.plus(tax),
        });
      }

      const created = await tx.purchaseOrder.create({
        data: {
          poNo,
          supplierId: Number(supplierId),
          orderDate: orderDate ? new Date(orderDate) : new Date(),
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          notes,
          subtotal,
          taxTotal,
          total: subtotal.plus(taxTotal),
          createdById: req.user?.id,
        },
        include: { items: true },
      });

      const needsApproval = await maybeRequestApproval(tx, {
        entityType: "PURCHASE_ORDER",
        entityId: created.id,
        entityRef: poNo,
        amount: created.total,
        requestedById: req.user?.id,
      });
      const final = await tx.purchaseOrder.update({
        where: { id: created.id },
        data: needsApproval
          ? { approvalStatus: "AWAITING_APPROVAL", status: "PENDING" }
          : { approvalStatus: "APPROVED", status: "APPROVED" },
        include: { items: { include: { product: true } }, supplier: true },
      });
      await logAudit({ action: "CREATE", module: MODULE, recordId: poNo, after: final, req }, tx);
      return final;
    });
    res.status(201).json(order);
  }),
);

purchaseRouter.put(
  "/orders/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Purchase order not found");
    if (before.status === "COMPLETED" || before.status === "CANCELLED") {
      badRequest("Completed or cancelled orders cannot be edited");
    }

    const { expectedDate, notes, status } = req.body ?? {};
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(expectedDate !== undefined && { expectedDate: expectedDate ? new Date(expectedDate) : null }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
      },
    });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: before.poNo, before, after: order, req });
    res.json(order);
  }),
);

purchaseRouter.delete(
  "/orders/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Purchase order not found");
    const invoices = await prisma.purchaseInvoice.count({ where: { orderId: id } });
    if (invoices > 0) badRequest("Order has invoices — cancel it instead of deleting");
    await prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
    await logAudit({ action: "DELETE", module: MODULE, recordId: before.poNo, before, req });
    res.json({ cancelled: true });
  }),
);

// ── Purchase invoices (posting moves stock + payable) ──

purchaseRouter.get(
  "/invoices",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.purchaseInvoice.findMany({
        include: { supplier: true, warehouse: true, items: { include: { product: true } } },
        orderBy: { invoiceDate: "desc" },
      }),
    );
  }),
);

purchaseRouter.post(
  "/invoices",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { orderId, supplierId, warehouseId, invoiceDate, notes, items } = req.body ?? {};
    if (!supplierId || !warehouseId || !Array.isArray(items) || items.length === 0) {
      badRequest("supplierId, warehouseId and items[] are required");
    }

    const invoice = await withTx(async (tx) => {
      const invNo = await nextDocNumber(tx, "purchase_invoice", "PI");
      let subtotal = new Prisma.Decimal(0);
      let taxTotal = new Prisma.Decimal(0);
      const lineData = [] as Prisma.PurchaseInvoiceItemCreateWithoutInvoiceInput[];
      for (const item of items) {
        const qty = new Prisma.Decimal(item.quantity);
        const rate = new Prisma.Decimal(item.rate);
        const lineNet = qty.mul(rate);
        let tax = new Prisma.Decimal(0);
        if (item.taxRateId) {
          const taxRate = await tx.taxRate.findUniqueOrThrow({ where: { id: Number(item.taxRateId) } });
          tax = lineNet.mul(taxRate.ratePercent).div(100);
        }
        subtotal = subtotal.plus(lineNet);
        taxTotal = taxTotal.plus(tax);
        lineData.push({
          product: { connect: { id: Number(item.productId) } },
          quantity: qty,
          rate,
          taxRate: item.taxRateId ? { connect: { id: Number(item.taxRateId) } } : undefined,
          taxAmount: tax,
          total: lineNet.plus(tax),
        });
      }

      const created = await tx.purchaseInvoice.create({
        data: {
          invNo,
          orderId: orderId ? Number(orderId) : null,
          supplierId: Number(supplierId),
          warehouseId: Number(warehouseId),
          invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
          notes,
          subtotal,
          taxTotal,
          total: subtotal.plus(taxTotal),
          createdById: req.user?.id,
        },
      });
      await postPurchaseInvoice(tx, created.id);
      await logAudit({ action: "CREATE", module: MODULE, recordId: invNo, after: created, req }, tx);
      return created;
    });
    res.status(201).json(invoice);
  }),
);

// ── Supplier payments ──

purchaseRouter.get(
  "/payments",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.supplierPayment.findMany({
        include: { supplier: true, account: true, invoice: true },
        orderBy: { date: "desc" },
      }),
    );
  }),
);

purchaseRouter.post(
  "/payments",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { supplierId, invoiceId, accountId, date, amount, method, reference, notes } = req.body ?? {};
    if (!supplierId || !accountId || !amount) badRequest("supplierId, accountId and amount are required");

    const payment = await withTx(async (tx) => {
      const paymentNo = await nextDocNumber(tx, "supplier_payment", "PAY");
      const created = await tx.supplierPayment.create({
        data: {
          paymentNo,
          supplierId: Number(supplierId),
          invoiceId: invoiceId ? Number(invoiceId) : null,
          accountId: Number(accountId),
          date: date ? new Date(date) : new Date(),
          amount,
          method,
          reference,
          notes,
          createdById: req.user?.id,
        },
      });

      const needsApproval = await maybeRequestApproval(tx, {
        entityType: "SUPPLIER_PAYMENT",
        entityId: created.id,
        entityRef: paymentNo,
        amount,
        requestedById: req.user?.id,
      });
      if (needsApproval) {
        await tx.supplierPayment.update({ where: { id: created.id }, data: { approvalStatus: "AWAITING_APPROVAL" } });
      } else {
        await tx.supplierPayment.update({ where: { id: created.id }, data: { approvalStatus: "APPROVED" } });
        await postSupplierPayment(tx, created.id);
      }
      await logAudit({ action: "CREATE", module: MODULE, recordId: paymentNo, after: created, req }, tx);
      return created;
    });
    res.status(201).json(payment);
  }),
);
