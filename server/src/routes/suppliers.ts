import { Router } from "express";
import { prisma, withTx } from "../db";
import { logAudit } from "../middleware/audit";
import { asyncHandler, badRequest, ApiError } from "../middleware/error";
import { requireRole } from "../middleware/auth";
import { nextDocNumber } from "../services/numbering";

export const suppliersRouter = Router();
const MODULE = "Suppliers";

suppliersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").toLowerCase();
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
    res.json(
      q
        ? suppliers.filter((s) => `${s.code} ${s.name} ${s.contactPerson ?? ""}`.toLowerCase().includes(q))
        : suppliers,
    );
  }),
);

suppliersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new ApiError(404, "Supplier not found");

    const [openInvoices, lastPayment, purchaseAgg] = await Promise.all([
      prisma.purchaseInvoice.count({ where: { supplierId: id, status: { in: ["UNPAID", "PARTIAL"] } } }),
      prisma.supplierPayment.findFirst({ where: { supplierId: id }, orderBy: { date: "desc" } }),
      prisma.purchaseInvoice.aggregate({ where: { supplierId: id }, _sum: { total: true } }),
    ]);
    res.json({ ...supplier, openInvoices, lastPayment, netPurchases: purchaseAgg._sum.total ?? 0 });
  }),
);

suppliersRouter.get(
  "/:id/ledger",
  asyncHandler(async (req, res) => {
    res.json(
      await prisma.supplierLedgerEntry.findMany({
        where: { supplierId: Number(req.params.id) },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      }),
    );
  }),
);

suppliersRouter.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    res.json(
      await prisma.purchaseInvoice.findMany({
        where: { supplierId: Number(req.params.id) },
        orderBy: { invoiceDate: "desc" },
        include: { items: { include: { product: true } } },
      }),
    );
  }),
);

suppliersRouter.get(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    res.json(
      await prisma.supplierPayment.findMany({
        where: { supplierId: Number(req.params.id) },
        orderBy: { date: "desc" },
        include: { account: true, invoice: true },
      }),
    );
  }),
);

suppliersRouter.post(
  "/",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { name, contactPerson, phone, email, address, paymentTerms } = req.body ?? {};
    if (!name) badRequest("name is required");

    const supplier = await withTx(async (tx) => {
      const code = await nextDocNumber(tx, "supplier_code", "SUP");
      const created = await tx.supplier.create({
        data: { code, name, contactPerson, phone, email, address, paymentTerms },
      });
      await logAudit({ action: "CREATE", module: MODULE, recordId: code, after: created, req }, tx);
      return created;
    });
    res.status(201).json(supplier);
  }),
);

suppliersRouter.put(
  "/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.supplier.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Supplier not found");

    const { name, contactPerson, phone, email, address, paymentTerms, status } = req.body ?? {};
    const supplier = await prisma.supplier.update({
      where: { id },
      data: { name, contactPerson, phone, email, address, paymentTerms, status },
    });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: before.code, before, after: supplier, req });
    res.json(supplier);
  }),
);

suppliersRouter.delete(
  "/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.supplier.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Supplier not found");

    const ledgerCount = await prisma.supplierLedgerEntry.count({ where: { supplierId: id } });
    if (ledgerCount > 0) {
      const supplier = await prisma.supplier.update({ where: { id }, data: { status: "INACTIVE" } });
      await logAudit({ action: "UPDATE", module: MODULE, recordId: before.code, after: { status: "INACTIVE" }, req });
      return res.json({ deactivated: true, supplier });
    }
    await prisma.supplier.delete({ where: { id } });
    await logAudit({ action: "DELETE", module: MODULE, recordId: before.code, before, req });
    res.json({ deleted: true });
  }),
);
