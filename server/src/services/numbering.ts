import type { Tx } from "../db";

// Atomic document numbering: INV-2609-041 style (prefix-yyMM-seq).
// Creates the sequence row lazily so new doc types need no setup.
export async function nextDocNumber(tx: Tx, docType: string, defaultPrefix: string): Promise<string> {
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
  return updated.yearInfix ? `${updated.prefix}-${yyMM}-${seqPart}` : `${updated.prefix}-${seqPart}`;
}
