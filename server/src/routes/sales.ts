import { Router } from "express";
import { prisma, withTx } from "../db";
import { Prisma } from "../generated/prisma/client";
import { logAudit } from "../middleware/audit";
import { asyncHandler, badRequest, ApiError } from "../middleware/error";
import { requireRole } from "../middleware/auth";
import { nextDocNumber } from "../services/numbering";
import { maybeRequestApproval } from "../services/approval";
import {
  postCollection,
  postDeliveryChalan,
  postSalesInvoice,
  postSalesReturn,
} from "../services/posting";

export const salesRouter = Router();
const MODULE = "Sales";

// ── Sales orders ──

salesRouter.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const where: Prisma.SalesOrderWhereInput = {};
    if (req.query.status) where.status = String(req.query.status) as never;
    if (req.query.buyerId) where.buyerId = Number(req.query.buyerId);
    res.json(
      await prisma.salesOrder.findMany({
        where,
        include: { buyer: true, items: { include: { product: true } } },
        orderBy: { orderDate: "desc" },
      }),
    );
  }),
);

salesRouter.get(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.salesOrder.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        buyer: true,
        items: { include: { product: { include: { unit: true } } } },
        deliveryChalans: { include: { items: true } },
        salesInvoices: true,
      },
    });
    if (!order) throw new ApiError(404, "Sales order not found");
    res.json(order);
  }),
);

salesRouter.post(
  "/orders",
  asyncHandler(async (req, res) => {
    const { buyerId, orderDate, dueDate, discount, notes, items } = req.body ?? {};
    if (!buyerId || !Array.isArray(items) || items.length === 0) {
      badRequest("buyerId and items[] are required");
    }

    const order = await withTx(async (tx) => {
      const soNo = await nextDocNumber(tx, "sales_order", "SO");
      let subtotal = new Prisma.Decimal(0);
      let taxTotal = new Prisma.Decimal(0);
      const lineData = [] as Prisma.SalesOrderItemCreateWithoutOrderInput[];
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
      const total = subtotal.plus(taxTotal).minus(discount ?? 0);

      const created = await tx.salesOrder.create({
        data: {
          soNo,
          buyerId: Number(buyerId),
          orderDate: orderDate ? new Date(orderDate) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          discount: discount ?? 0,
          subtotal,
          taxTotal,
          total,
          notes,
          createdById: req.user?.id,
        },
      });

      // Orders over threshold OR carrying a discount need sign-off.
      const needsApproval =
        (await maybeRequestApproval(tx, {
          entityType: "SALES_ORDER",
          entityId: created.id,
          entityRef: soNo,
          amount: total,
          requestedById: req.user?.id,
        })) ||
        (Number(discount ?? 0) > 0 &&
          (await maybeRequestApproval(tx, {
            entityType: "SALES_DISCOUNT",
            entityId: created.id,
            entityRef: soNo,
            amount: discount,
            reason: "Discount applied on sales order",
            requestedById: req.user?.id,
          })));

      const final = await tx.salesOrder.update({
        where: { id: created.id },
        data: needsApproval
          ? { approvalStatus: "AWAITING_APPROVAL", status: "PENDING" }
          : { approvalStatus: "APPROVED", status: "APPROVED" },
        include: { items: { include: { product: true } }, buyer: true },
      });
      await logAudit({ action: "CREATE", module: MODULE, recordId: soNo, after: final, req }, tx);
      return final;
    });
    res.status(201).json(order);
  }),
);

salesRouter.put(
  "/orders/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.salesOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Sales order not found");
    if (before.status === "COMPLETED" || before.status === "CANCELLED") {
      badRequest("Completed or cancelled orders cannot be edited");
    }
    const { dueDate, notes, status } = req.body ?? {};
    const order = await prisma.salesOrder.update({
      where: { id },
      data: {
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
      },
    });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: before.soNo, before, after: order, req });
    res.json(order);
  }),
);

salesRouter.delete(
  "/orders/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.salesOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Sales order not found");
    const docs = (await prisma.deliveryChalan.count({ where: { salesOrderId: id } })) +
      (await prisma.salesInvoice.count({ where: { salesOrderId: id } }));
    if (docs > 0) badRequest("Order has chalans/invoices — cancel it instead of deleting");
    await prisma.salesOrder.update({ where: { id }, data: { status: "CANCELLED" } });
    await logAudit({ action: "DELETE", module: MODULE, recordId: before.soNo, before, req });
    res.json({ cancelled: true });
  }),
);

// ── Delivery chalans (posting moves stock OUT) ──

salesRouter.get(
  "/chalans",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.deliveryChalan.findMany({
        include: { buyer: true, warehouse: true, salesOrder: true, items: { include: { product: true } } },
        orderBy: { date: "desc" },
      }),
    );
  }),
);

salesRouter.post(
  "/chalans",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { salesOrderId, buyerId, warehouseId, date, driverName, vehicleNo, notes, items } = req.body ?? {};
    if (!buyerId || !warehouseId || !Array.isArray(items) || items.length === 0) {
      badRequest("buyerId, warehouseId and items[] are required");
    }
    if (salesOrderId) {
      const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: Number(salesOrderId) } });
      if (so.approvalStatus === "AWAITING_APPROVAL") badRequest("Sales order is awaiting approval");
    }

    const chalan = await withTx(async (tx) => {
      const dcNo = await nextDocNumber(tx, "delivery_chalan", "DC");
      const created = await tx.deliveryChalan.create({
        data: {
          dcNo,
          salesOrderId: salesOrderId ? Number(salesOrderId) : null,
          buyerId: Number(buyerId),
          warehouseId: Number(warehouseId),
          date: date ? new Date(date) : new Date(),
          driverName,
          vehicleNo,
          notes,
          createdById: req.user?.id,
          items: {
            create: items.map((i: { productId: number; quantity: number }) => ({
              productId: Number(i.productId),
              quantity: i.quantity,
            })),
          },
        },
      });
      await postDeliveryChalan(tx, created.id);
      await logAudit({ action: "CREATE", module: MODULE, recordId: dcNo, after: created, req }, tx);
      return created;
    });
    res.status(201).json(chalan);
  }),
);

// ── Sales invoices (posting moves receivable) ──

salesRouter.get(
  "/invoices",
  asyncHandler(async (req, res) => {
    const where: Prisma.SalesInvoiceWhereInput = {};
    if (req.query.buyerId) where.buyerId = Number(req.query.buyerId);
    if (req.query.from || req.query.to) {
      where.invoiceDate = {
        ...(req.query.from && { gte: new Date(String(req.query.from)) }),
        ...(req.query.to && { lte: new Date(String(req.query.to)) }),
      };
    }
    res.json(
      await prisma.salesInvoice.findMany({
        where,
        include: { buyer: true, items: { include: { product: true } } },
        orderBy: { invoiceDate: "desc" },
      }),
    );
  }),
);

salesRouter.post(
  "/invoices",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { salesOrderId, chalanId, buyerId, invoiceDate, dueDate, vatMode, discount, notes, items } =
      req.body ?? {};
    if (!buyerId || !Array.isArray(items) || items.length === 0) {
      badRequest("buyerId and items[] are required");
    }

    const invoice = await withTx(async (tx) => {
      const invNo = await nextDocNumber(tx, "sales_invoice", "INV");
      const inclusive = vatMode === "INCLUSIVE";
      let subtotal = new Prisma.Decimal(0);
      let taxTotal = new Prisma.Decimal(0);
      const lineData = [] as Prisma.SalesInvoiceItemCreateWithoutInvoiceInput[];
      for (const item of items) {
        const qty = new Prisma.Decimal(item.quantity);
        const rate = new Prisma.Decimal(item.rate);
        const gross = qty.mul(rate);
        let tax = new Prisma.Decimal(0);
        let net = gross;
        if (item.taxRateId) {
          const taxRate = await tx.taxRate.findUniqueOrThrow({ where: { id: Number(item.taxRateId) } });
          const pct = taxRate.ratePercent;
          if (inclusive) {
            // rate already includes VAT: net = gross / (1 + pct/100)
            net = gross.div(pct.plus(100)).mul(100);
            tax = gross.minus(net);
          } else {
            tax = gross.mul(pct).div(100);
          }
        }
        subtotal = subtotal.plus(net);
        taxTotal = taxTotal.plus(tax);
        lineData.push({
          product: { connect: { id: Number(item.productId) } },
          quantity: qty,
          rate,
          taxRate: item.taxRateId ? { connect: { id: Number(item.taxRateId) } } : undefined,
          taxAmount: tax,
          total: net.plus(tax),
        });
      }
      const total = subtotal.plus(taxTotal).minus(discount ?? 0);

      const created = await tx.salesInvoice.create({
        data: {
          invNo,
          salesOrderId: salesOrderId ? Number(salesOrderId) : null,
          chalanId: chalanId ? Number(chalanId) : null,
          buyerId: Number(buyerId),
          invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          vatMode: inclusive ? "INCLUSIVE" : "EXCLUSIVE",
          discount: discount ?? 0,
          subtotal,
          taxTotal,
          total,
          notes,
          createdById: req.user?.id,
        },
      });
      await postSalesInvoice(tx, created.id);
      await logAudit({ action: "CREATE", module: MODULE, recordId: invNo, after: created, req }, tx);
      return created;
    });
    res.status(201).json(invoice);
  }),
);

// ── Sales returns ──

salesRouter.get(
  "/returns",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.salesReturn.findMany({
        include: { buyer: true, invoice: true, warehouse: true, items: { include: { product: true } } },
        orderBy: { date: "desc" },
      }),
    );
  }),
);

salesRouter.post(
  "/returns",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { invoiceId, buyerId, warehouseId, date, reason, items } = req.body ?? {};
    if (!invoiceId || !buyerId || !warehouseId || !Array.isArray(items) || items.length === 0) {
      badRequest("invoiceId, buyerId, warehouseId and items[] are required");
    }

    const ret = await withTx(async (tx) => {
      const returnNo = await nextDocNumber(tx, "sales_return", "SR");
      let total = new Prisma.Decimal(0);
      const lineData = items.map((i: { productId: number; quantity: number; rate: number }) => {
        const lineTotal = new Prisma.Decimal(i.quantity).mul(i.rate);
        total = total.plus(lineTotal);
        return { productId: Number(i.productId), quantity: i.quantity, rate: i.rate, total: lineTotal };
      });
      const created = await tx.salesReturn.create({
        data: {
          returnNo,
          invoiceId: Number(invoiceId),
          buyerId: Number(buyerId),
          warehouseId: Number(warehouseId),
          date: date ? new Date(date) : new Date(),
          reason,
          total,
          createdById: req.user?.id,
          items: { create: lineData },
        },
      });
      await postSalesReturn(tx, created.id);
      await logAudit({ action: "CREATE", module: MODULE, recordId: returnNo, after: created, req }, tx);
      return created;
    });
    res.status(201).json(ret);
  }),
);

// ── Payment collections ──

salesRouter.get(
  "/collections",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.paymentCollection.findMany({
        include: { buyer: true, account: true, invoice: true },
        orderBy: { date: "desc" },
      }),
    );
  }),
);

salesRouter.post(
  "/collections",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { buyerId, invoiceId, accountId, date, amount, method, reference, notes } = req.body ?? {};
    if (!buyerId || !accountId || !amount) badRequest("buyerId, accountId and amount are required");

    const collection = await withTx(async (tx) => {
      const collectionNo = await nextDocNumber(tx, "payment_collection", "RCV");
      const created = await tx.paymentCollection.create({
        data: {
          collectionNo,
          buyerId: Number(buyerId),
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
        entityType: "PAYMENT_COLLECTION",
        entityId: created.id,
        entityRef: collectionNo,
        amount,
        requestedById: req.user?.id,
      });
      if (needsApproval) {
        await tx.paymentCollection.update({ where: { id: created.id }, data: { approvalStatus: "AWAITING_APPROVAL" } });
      } else {
        await tx.paymentCollection.update({ where: { id: created.id }, data: { approvalStatus: "APPROVED" } });
        await postCollection(tx, created.id);
      }
      await logAudit({ action: "CREATE", module: MODULE, recordId: collectionNo, after: created, req }, tx);
      return created;
    });
    res.status(201).json(collection);
  }),
);

// ── Sales history (buyer/product/date filters) ──

salesRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const { buyerId, productId, from, to } = req.query;
    const invoices = await prisma.salesInvoice.findMany({
      where: {
        ...(buyerId && { buyerId: Number(buyerId) }),
        ...((from || to) && {
          invoiceDate: {
            ...(from && { gte: new Date(String(from)) }),
            ...(to && { lte: new Date(String(to)) }),
          },
        }),
        ...(productId && { items: { some: { productId: Number(productId) } } }),
      },
      include: { buyer: true, items: { include: { product: true } } },
      orderBy: { invoiceDate: "desc" },
    });
    res.json(invoices);
  }),
);
