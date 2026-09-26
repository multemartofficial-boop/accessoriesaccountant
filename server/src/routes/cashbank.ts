import { Router } from "express";
import { prisma, withTx } from "../db";
import { logAudit } from "../middleware/audit";
import { asyncHandler, badRequest, ApiError } from "../middleware/error";
import { requireRole } from "../middleware/auth";
import { applyCashTransaction } from "../services/posting";
import { postJournal } from "../services/journal";

export const cashBankRouter = Router();
const MODULE = "Cash & Bank";

cashBankRouter.get(
  "/accounts",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.cashAccount.findMany({ orderBy: { id: "asc" } }));
  }),
);

cashBankRouter.post(
  "/accounts",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { name, type, bankName, accountNo, openingBalance } = req.body ?? {};
    if (!name || !type) badRequest("name and type (CASH|BANK) are required");
    const account = await prisma.cashAccount.create({
      data: {
        name,
        type,
        bankName,
        accountNo,
        openingBalance: openingBalance ?? 0,
        balance: openingBalance ?? 0,
      },
    });
    await logAudit({ action: "CREATE", module: MODULE, recordId: name, after: account, req });
    res.status(201).json(account);
  }),
);

cashBankRouter.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const { accountId, from, to, type } = req.query;
    res.json(
      await prisma.cashTransaction.findMany({
        where: {
          ...(accountId && { accountId: Number(accountId) }),
          ...(type && { type: String(type) as never }),
          ...((from || to) && {
            date: {
              ...(from && { gte: new Date(String(from)) }),
              ...(to && { lte: new Date(String(to)) }),
            },
          }),
        },
        include: { account: true, toAccount: true },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: 500,
      }),
    );
  }),
);

// Manual transaction entry: receipt / payment / transfer / adjustment.
cashBankRouter.post(
  "/transactions",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { accountId, toAccountId, type, direction, amount, date, particulars, reference } =
      req.body ?? {};
    if (!accountId || !type || !amount) badRequest("accountId, type and amount are required");
    if (type === "TRANSFER" && !toAccountId) badRequest("toAccountId is required for transfers");

    const txn = await withTx(async (tx) => {
      const created = await applyCashTransaction(tx, {
        accountId: Number(accountId),
        toAccountId: toAccountId ? Number(toAccountId) : undefined,
        type,
        direction: direction === "IN" ? "IN" : "OUT",
        amount: Number(amount),
        date: date ? new Date(date) : new Date(),
        particulars,
        reference,
        createdById: req.user?.id,
      });

      // Journal for manual entries — auto-entries post their own journals.
      const account = await tx.cashAccount.findUniqueOrThrow({ where: { id: Number(accountId) } });
      const cashCode = account.type === "CASH" ? "1100" : "1110";
      const amt = Number(amount);
      if (type === "TRANSFER" && toAccountId) {
        const dest = await tx.cashAccount.findUniqueOrThrow({ where: { id: Number(toAccountId) } });
        await postJournal(tx, {
          date: created.date,
          memo: particulars ?? `Transfer ${created.txnNo}`,
          refType: "cash_transaction",
          refId: created.id,
          lines: [
            { accountCode: dest.type === "CASH" ? "1100" : "1110", debit: amt },
            { accountCode: cashCode, credit: amt },
          ],
        });
      } else if (type === "RECEIPT") {
        await postJournal(tx, {
          date: created.date,
          memo: particulars ?? `Receipt ${created.txnNo}`,
          refType: "cash_transaction",
          refId: created.id,
          lines: [
            { accountCode: cashCode, debit: amt },
            { accountCode: "4900", credit: amt }, // Other income
          ],
        });
      } else if (type === "PAYMENT") {
        await postJournal(tx, {
          date: created.date,
          memo: particulars ?? `Payment ${created.txnNo}`,
          refType: "cash_transaction",
          refId: created.id,
          lines: [
            { accountCode: "5300", debit: amt }, // Operating expense
            { accountCode: cashCode, credit: amt },
          ],
        });
      }
      // ADJUSTMENT posts no journal — used for opening corrections.

      await logAudit({ action: "CREATE", module: MODULE, recordId: created.txnNo, after: created, req }, tx);
      return created;
    });
    res.status(201).json(txn);
  }),
);

// Day-wise statement per account.
cashBankRouter.get(
  "/statement",
  asyncHandler(async (req, res) => {
    const accountId = Number(req.query.accountId);
    if (!accountId) badRequest("accountId is required");
    const account = await prisma.cashAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new ApiError(404, "Account not found");

    const from = req.query.from ? new Date(String(req.query.from)) : new Date("1970-01-01");
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const entries = await prisma.cashTransaction.findMany({
      where: { accountId, date: { gte: from, lte: to } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
    res.json({ account, entries, from, to });
  }),
);
