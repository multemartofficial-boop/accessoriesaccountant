import { ApiError } from "../middleware/error";
import type { Tx } from "../db";
import { nextDocNumber } from "./numbering";

interface JournalLineInput {
  accountCode: string; // resolved against the seeded chart of accounts
  debit?: number;
  credit?: number;
  partyType?: "buyer" | "supplier";
  partyId?: number;
}

// Auto-posted double-entry journal. Services call this — nothing else does.
export async function postJournal(
  tx: Tx,
  input: { date?: Date; memo?: string; refType?: string; refId?: number; lines: JournalLineInput[] },
) {
  const totalDebit = input.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = input.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new ApiError(500, `Unbalanced journal for ${input.refType}#${input.refId}: dr ${totalDebit} cr ${totalCredit}`);
  }

  const codes = [...new Set(input.lines.map((l) => l.accountCode))];
  const accounts = await tx.account.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of codes) {
    if (!byCode.has(code)) throw new ApiError(500, `Missing GL account ${code} — run the seed`);
  }

  const entryNo = await nextDocNumber(tx, "journal_entry", "JE");
  return tx.journalEntry.create({
    data: {
      entryNo,
      date: input.date ?? new Date(),
      memo: input.memo,
      refType: input.refType,
      refId: input.refId,
      lines: {
        create: input.lines.map((l) => ({
          accountId: byCode.get(l.accountCode)!,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          partyType: l.partyType,
          partyId: l.partyId,
        })),
      },
    },
    include: { lines: true },
  });
}
