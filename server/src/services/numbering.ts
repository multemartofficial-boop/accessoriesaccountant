import { prisma } from "../db";
import type { Tx } from "../db";

// Atomic document numbering: INV-2609-041 style (prefix-yyMM-seq).
// Creates the sequence row lazily so new doc types need no setup.
export async function nextDocNumber(
  tx: Tx,
  docType: string,
  defaultPrefix: string,
): Promise<string> {
  await tx.documentSequence.upsert({
    where: { docType },
    create: { docType, prefix: defaultPrefix },
    update: {},
  });
  // Atomic increment — avoids the read-then-write race where two concurrent
  // requests could be handed the same document number.
  const updated = await tx.documentSequence.update({
    where: { docType },
    data: { lastNumber: { increment: 1 } },
  });
  const next = updated.lastNumber;
  const now = new Date();
  const yyMM = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const seqPart = String(next).padStart(updated.padding, "0");
  return updated.yearInfix
    ? `${updated.prefix}-${yyMM}-${seqPart}`
    : `${updated.prefix}-${seqPart}`;
}

// Read-only preview of the number nextDocNumber will hand out — used to show
// the upcoming number in form fields without consuming it.
export async function peekDocNumber(docType: string, defaultPrefix: string): Promise<string> {
  const seq = await prisma.documentSequence.findUnique({ where: { docType } });
  const prefix = seq?.prefix ?? defaultPrefix;
  const padding = seq?.padding ?? 3;
  const yearInfix = seq?.yearInfix ?? true;
  const next = (seq?.lastNumber ?? 0) + 1;
  const now = new Date();
  const yyMM = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const seqPart = String(next).padStart(padding, "0");
  return yearInfix ? `${prefix}-${yyMM}-${seqPart}` : `${prefix}-${seqPart}`;
}
