// Resyncs DocumentSequence.lastNumber with the max sequence already used in the
// real tables. Needed because seed data / manual inserts can bypass
// nextDocNumber(), which would then hand out a duplicate number.
// Run with: npm run db:resync
import { prisma } from "../src/db";

const targets = [
  { docType: "buyer_code", model: "buyer", field: "code", prefix: "BUY" },
  { docType: "supplier_code", model: "supplier", field: "code", prefix: "SUP" },
  { docType: "purchase_order", model: "purchaseOrder", field: "poNo", prefix: "PO" },
  { docType: "purchase_invoice", model: "purchaseInvoice", field: "invNo", prefix: "PI" },
  { docType: "sales_order", model: "salesOrder", field: "soNo", prefix: "SO" },
  { docType: "sales_invoice", model: "salesInvoice", field: "invNo", prefix: "INV" },
  { docType: "delivery_chalan", model: "deliveryChalan", field: "dcNo", prefix: "DC" },
  { docType: "supplier_payment", model: "supplierPayment", field: "paymentNo", prefix: "PAY" },
  { docType: "payment_collection", model: "paymentCollection", field: "collectionNo", prefix: "RCV" },
  { docType: "sales_return", model: "salesReturn", field: "returnNo", prefix: "SR" },
  { docType: "stock_adjustment", model: "stockAdjustment", field: "adjNo", prefix: "ADJ" },
  { docType: "stock_transfer", model: "stockTransfer", field: "transferNo", prefix: "TRF" },
  { docType: "cash_transaction", model: "cashTransaction", field: "txnNo", prefix: "TXN" },
  { docType: "journal_entry", model: "journalEntry", field: "entryNo", prefix: "JE" },
] as const;

// The sequence number is the last run of digits in the document code.
// Handles "BUY-006", "PO-2609-041" (yyMM infix) and "TXN-2609-181-IN" (mirror leg).
function seqPart(code: string): number {
  const runs = code.match(/\d+/g);
  return runs ? Number(runs[runs.length - 1]) : 0;
}

export async function resyncSequences() {
  for (const t of targets) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: { [k: string]: string }[] = await (prisma as any)[t.model].findMany({
      select: { [t.field]: true },
    });
    const max = rows.reduce((m, r) => Math.max(m, seqPart(r[t.field])), 0);
    const existing = await prisma.documentSequence.findUnique({ where: { docType: t.docType } });
    if (existing && existing.lastNumber >= max) continue;
    await prisma.documentSequence.upsert({
      where: { docType: t.docType },
      create: { docType: t.docType, prefix: t.prefix, lastNumber: max },
      update: { lastNumber: max },
    });
    console.log(`${t.docType}: lastNumber -> ${max}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("resync-sequences.ts")) {
  resyncSequences()
    .then(() => console.log("Sequences resynced."))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
