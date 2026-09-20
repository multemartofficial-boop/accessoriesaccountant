import type { Tx } from "../db";

// Atomic document numbering: INV-2609-041 style (prefix-yyMM-seq).
// Creates the sequence row lazily so new doc types need no setup.
export async function nextDocNumber(tx: Tx, docType: string, defaultPrefix: string): Promise<string> {
  const seq = await tx.documentSequence.upsert({
    where: { docType },
    create: { docType, prefix: defaultPrefix },
    update: {},
  });
  const next = seq.lastNumber + 1;
  const updated = await tx.documentSequence.update({
    where: { docType },
    data: { lastNumber: next },
  });
  const now = new Date();
  const yyMM = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const seqPart = String(next).padStart(updated.padding, "0");
  return updated.yearInfix ? `${updated.prefix}-${yyMM}-${seqPart}` : `${updated.prefix}-${seqPart}`;
}
