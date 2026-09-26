import { Router } from "express";
import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import { asyncHandler } from "../middleware/error";
import { requireRole } from "../middleware/auth";

export const reportsRouter = Router();
const D0 = () => new Prisma.Decimal(0);

function range(req: { query: Record<string, unknown> }) {
  const now = new Date();
  // A bare "YYYY-MM-DD" parses to midnight — extend to end of day so entries
  // posted on the `to` date are included.
  const to = req.query.to ? new Date(String(req.query.to)) : now;
  if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to))) to.setUTCHours(23, 59, 59, 999);
  return {
    from: req.query.from ? new Date(String(req.query.from)) : new Date(now.getFullYear(), now.getMonth(), 1),
    to,
  };
}

// Sum journal lines per account within a range.
async function accountTotals(from: Date, to: Date) {
  const lines = await prisma.journalLine.findMany({
    where: { entry: { date: { gte: from, lte: to } } },
    include: { account: true },
  });
  const totals = new Map<string, { account: (typeof lines)[0]["account"]; debit: Prisma.Decimal; credit: Prisma.Decimal }>();
  for (const l of lines) {
    const e = totals.get(l.account.code) ?? { account: l.account, debit: D0(), credit: D0() };
    e.debit = e.debit.plus(l.debit);
    e.credit = e.credit.plus(l.credit);
    totals.set(l.account.code, e);
  }
  return totals;
}

reportsRouter.get(
  "/pnl",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { from, to } = range(req);
    const totals = await accountTotals(from, to);
    const rows = [...totals.values()]
      .filter((t) => t.account.category === "INCOME" || t.account.category === "EXPENSE")
      .map((t) => ({
        code: t.account.code,
        account: t.account.name,
        category: t.account.category,
        debit: t.debit,
        credit: t.credit,
        net: t.account.category === "INCOME" ? t.credit.minus(t.debit) : t.debit.minus(t.credit),
      }));
    const revenue = rows.filter((r) => r.category === "INCOME").reduce((s, r) => s.plus(r.net), D0());
    const expenses = rows.filter((r) => r.category === "EXPENSE").reduce((s, r) => s.plus(r.net), D0());
    const cogs = totals.get("5100")?.debit.minus(totals.get("5100")?.credit ?? 0) ?? D0();
    res.json({ from, to, rows, revenue, expenses, cogs, grossProfit: revenue.minus(cogs), netProfit: revenue.minus(expenses) });
  }),
);

reportsRouter.get(
  "/trial-balance",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { from, to } = range(req);
    const totals = await accountTotals(from, to);
    const rows = [...totals.values()].map((t) => ({
      code: t.account.code,
      account: t.account.name,
      category: t.account.category,
      debit: t.debit,
      credit: t.credit,
      balance: t.debit.minus(t.credit),
    }));
    res.json({
      from,
      to,
      rows,
      totalDebit: rows.reduce((s, r) => s.plus(r.debit), D0()),
      totalCredit: rows.reduce((s, r) => s.plus(r.credit), D0()),
    });
  }),
);

reportsRouter.get(
  "/general-ledger",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { from, to } = range(req);
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    res.json(
      await prisma.journalLine.findMany({
        where: { ...(accountId && { accountId }), entry: { date: { gte: from, lte: to } } },
        include: { entry: true, account: true },
        orderBy: { entry: { date: "asc" } },
      }),
    );
  }),
);

reportsRouter.get(
  "/accounts",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.account.findMany({ orderBy: { code: "asc" } }));
  }),
);

reportsRouter.get(
  "/balance-sheet",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { to } = range(req);
    const totals = await accountTotals(new Date("1970-01-01"), to);
    const rows = [...totals.values()].map((t) => ({
      code: t.account.code,
      account: t.account.name,
      category: t.account.category,
      balance: t.account.category === "LIABILITY" || t.account.category === "EQUITY" || t.account.category === "INCOME"
        ? t.credit.minus(t.debit)
        : t.debit.minus(t.credit),
    }));
    const sum = (cat: string) => rows.filter((r) => r.category === cat).reduce((s, r) => s.plus(r.balance), D0());
    const netProfit = sum("INCOME").minus(sum("EXPENSE"));
    // Income/expense accounts are not closed to retained earnings, so the
    // period result must appear on the equity side or the sheet can't balance.
    const equity = [
      ...rows.filter((r) => r.category === "EQUITY"),
      { code: "3900", account: "Current period earnings", category: "EQUITY", balance: netProfit },
    ];
    res.json({
      to,
      assets: rows.filter((r) => r.category === "ASSET"),
      liabilities: rows.filter((r) => r.category === "LIABILITY"),
      equity,
      netProfit,
      totalAssets: sum("ASSET"),
      totalLiabilitiesEquity: sum("LIABILITY").plus(sum("EQUITY")).plus(netProfit),
    });
  }),
);

// Receivable aging — buckets open invoices by days outstanding.
reportsRouter.get(
  "/aging/receivable",
  asyncHandler(async (_req, res) => {
    const invoices = await prisma.salesInvoice.findMany({
      where: { status: { in: ["UNPAID", "PARTIAL"] } },
      include: { buyer: true },
    });
    res.json(ageBuckets(invoices.map((i) => ({ party: i.buyer.name, date: i.invoiceDate, due: i.dueDate, open: i.total.minus(i.paidAmount) }))));
  }),
);

reportsRouter.get(
  "/aging/payable",
  asyncHandler(async (_req, res) => {
    const invoices = await prisma.purchaseInvoice.findMany({
      where: { status: { in: ["UNPAID", "PARTIAL"] } },
      include: { supplier: true },
    });
    res.json(ageBuckets(invoices.map((i) => ({ party: i.supplier.name, date: i.invoiceDate, due: null, open: i.total.minus(i.paidAmount) }))));
  }),
);

function ageBuckets(items: { party: string; date: Date; due: Date | null; open: Prisma.Decimal }[]) {
  const now = Date.now();
  const days = (d: Date) => Math.floor((now - d.getTime()) / 86400000);
  const buckets = { current: D0(), d30: D0(), d60: D0(), d90plus: D0() };
  const rows = items.map((i) => {
    const age = days(i.due ?? i.date);
    const bucket = age <= 30 ? "current" : age <= 60 ? "d30" : age <= 90 ? "d60" : "d90plus";
    buckets[bucket as keyof typeof buckets] = buckets[bucket as keyof typeof buckets].plus(i.open);
    return { ...i, ageDays: age, bucket };
  });
  return { rows, buckets };
}
