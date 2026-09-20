import { Router } from "express";
import { prisma, withTx } from "../db";
import { logAudit } from "../middleware/audit";
import { asyncHandler, badRequest, ApiError } from "../middleware/error";
import { requireRole } from "../middleware/auth";
import { nextDocNumber } from "../services/numbering";

export const buyersRouter = Router();
const MODULE = "Buyers";

buyersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").toLowerCase();
    const buyers = await prisma.buyer.findMany({ orderBy: { name: "asc" } });
    res.json(
      q
        ? buyers.filter((b) => `${b.code} ${b.name} ${b.contactPerson ?? ""}`.toLowerCase().includes(q))
        : buyers,
    );
  }),
);

buyersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const buyer = await prisma.buyer.findUnique({ where: { id } });
    if (!buyer) throw new ApiError(404, "Buyer not found");

    const [openInvoices, lastPayment, salesAgg] = await Promise.all([
      prisma.salesInvoice.count({ where: { buyerId: id, status: { in: ["UNPAID", "PARTIAL"] } } }),
      prisma.paymentCollection.findFirst({ where: { buyerId: id }, orderBy: { date: "desc" } }),
      prisma.salesInvoice.aggregate({ where: { buyerId: id }, _sum: { total: true } }),
    ]);
    res.json({ ...buyer, openInvoices, lastPayment, netSales: salesAgg._sum.total ?? 0 });
  }),
);

buyersRouter.get(
  "/:id/ledger",
  asyncHandler(async (req, res) => {
    const entries = await prisma.buyerLedgerEntry.findMany({
      where: { buyerId: Number(req.params.id) },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
    res.json(entries);
  }),
);

buyersRouter.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const invoices = await prisma.salesInvoice.findMany({
      where: { buyerId: Number(req.params.id) },
      orderBy: { invoiceDate: "desc" },
      include: { items: { include: { product: true } } },
    });
    res.json(invoices);
  }),
);

// Statement data — the frontend renders + prints this (invoice letterhead
// comes from the same shape as /api/documents/:id output).
buyersRouter.get(
  "/:id/statement",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const buyer = await prisma.buyer.findUnique({ where: { id } });
    if (!buyer) throw new ApiError(404, "Buyer not found");

    const from = req.query.from ? new Date(String(req.query.from)) : new Date("1970-01-01");
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const entries = await prisma.buyerLedgerEntry.findMany({
      where: { buyerId: id, date: { gte: from, lte: to } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
    const opening = entries.length
      ? entries[0]!.balanceAfter.minus(entries[0]!.debit).plus(entries[0]!.credit)
      : buyer.outstanding;
    res.json({ buyer, opening, entries, closing: buyer.outstanding, from, to });
  }),
);

buyersRouter.post(
  "/",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { name, contactPerson, phone, email, address, paymentTerms, creditLimit } = req.body ?? {};
    if (!name) badRequest("name is required");

    const buyer = await withTx(async (tx) => {
      const code = await nextDocNumber(tx, "buyer_code", "BUY");
      const created = await tx.buyer.create({
        data: { code, name, contactPerson, phone, email, address, paymentTerms, creditLimit: creditLimit ?? 0 },
      });
      await logAudit({ action: "CREATE", module: MODULE, recordId: code, after: created, req }, tx);
      return created;
    });
    res.status(201).json(buyer);
  }),
);

buyersRouter.put(
  "/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.buyer.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Buyer not found");

    const { name, contactPerson, phone, email, address, paymentTerms, creditLimit, status } = req.body ?? {};
    const buyer = await prisma.buyer.update({
      where: { id },
      data: { name, contactPerson, phone, email, address, paymentTerms, creditLimit, status },
    });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: before.code, before, after: buyer, req });
    res.json(buyer);
  }),
);

buyersRouter.delete(
  "/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.buyer.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Buyer not found");

    const ledgerCount = await prisma.buyerLedgerEntry.count({ where: { buyerId: id } });
    if (ledgerCount > 0) {
      // Preserve history — deactivate instead of deleting.
      const buyer = await prisma.buyer.update({ where: { id }, data: { status: "INACTIVE" } });
      await logAudit({ action: "UPDATE", module: MODULE, recordId: before.code, after: { status: "INACTIVE" }, req });
      return res.json({ deactivated: true, buyer });
    }
    await prisma.buyer.delete({ where: { id } });
    await logAudit({ action: "DELETE", module: MODULE, recordId: before.code, before, req });
    res.json({ deleted: true });
  }),
);
