import { Prisma, type PrismaClient } from "../generated/prisma/client";

const EPS = 0.01;
const dec = (v: unknown) => Number(v ?? 0);

export interface IntegrityIssue {
  check: string;
  detail: string;
  expected: number;
  actual: number;
}

// Cross-checks every maintained balance against its transaction history.
// If the posting services are the only writers (they are), this should always
// come back clean — any drift is a bug worth surfacing immediately.
export async function runIntegrityChecks(db: PrismaClient): Promise<{ ok: boolean; issues: IntegrityIssue[] }> {
  const issues: IntegrityIssue[] = [];
  const push = (check: string, detail: string, expected: number, actual: number) => {
    if (Math.abs(expected - actual) > EPS) issues.push({ check, detail, expected, actual });
  };

  // 1) Every journal entry must balance (debits = credits).
  const entries = await db.journalEntry.findMany({ include: { lines: true } });
  for (const e of entries) {
    const dr = e.lines.reduce((s, l) => s + dec(l.debit), 0);
    const cr = e.lines.reduce((s, l) => s + dec(l.credit), 0);
    push("journal_balance", `Journal ${e.entryNo}`, dr, cr);
  }

  // 2) Trial balance: total debits = total credits across all lines.
  const totals = await db.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  push("trial_balance", "All journal lines", dec(totals._sum.debit), dec(totals._sum.credit));

  // 3) Cash/bank: account.balance = openingBalance + Σ signed transactions.
  const accounts = await db.cashAccount.findMany({ include: { transactions: true } });
  for (const a of accounts) {
    const sum = a.transactions.reduce((s, t) => {
      const inbound = t.type === "RECEIPT" || (t.type === "TRANSFER" && t.txnNo.endsWith("-IN"));
      return s + (inbound ? dec(t.amount) : -dec(t.amount));
    }, 0);
    push("cash_balance", `${a.name} (id ${a.id})`, dec(a.openingBalance) + sum, dec(a.balance));
  }

  // 4) Stock: balance.quantity = Σ movements for that product+warehouse.
  const balances = await db.stockBalance.findMany({
    include: { product: { select: { name: true, sku: true } }, warehouse: { select: { name: true } } },
  });
  for (const b of balances) {
    const agg = await db.stockMovement.aggregate({
      where: { productId: b.productId, warehouseId: b.warehouseId },
      _sum: { quantity: true },
    });
    push(
      "stock_balance",
      `${b.product.sku} @ ${b.warehouse.name}`,
      dec(agg._sum.quantity),
      dec(b.quantity),
    );
    if (dec(b.quantity) < -EPS) {
      issues.push({ check: "negative_stock", detail: `${b.product.sku} @ ${b.warehouse.name}`, expected: 0, actual: dec(b.quantity) });
    }
  }

  // 5) Buyer outstanding = Σ(ledger debit - credit); supplier payable = Σ(credit - debit).
  const buyers = await db.buyer.findMany({ include: { ledgerEntries: true } });
  for (const b of buyers) {
    const sum = b.ledgerEntries.reduce((s, e) => s + dec(e.debit) - dec(e.credit), 0);
    push("buyer_outstanding", `${b.code} ${b.name}`, sum, dec(b.outstanding));
  }
  const suppliers = await db.supplier.findMany({ include: { ledgerEntries: true } });
  for (const s of suppliers) {
    const sum = s.ledgerEntries.reduce((acc, e) => acc - dec(e.debit) + dec(e.credit), 0);
    push("supplier_payable", `${s.code} ${s.name}`, sum, dec(s.payable));
  }

  // 6) Invoice paidAmount = Σ linked payments/collections.
  const salesInvoices = await db.salesInvoice.findMany({ include: { collections: true } });
  for (const inv of salesInvoices) {
    const paid = inv.collections.reduce((s, c) => s + dec(c.amount), 0);
    push("invoice_paid", `Sales invoice ${inv.invNo}`, paid, dec(inv.paidAmount));
  }
  const purchaseInvoices = await db.purchaseInvoice.findMany({ include: { payments: true } });
  for (const inv of purchaseInvoices) {
    const paid = inv.payments.reduce((s, p) => s + dec(p.amount), 0);
    push("invoice_paid", `Purchase invoice ${inv.invNo}`, paid, dec(inv.paidAmount));
  }

  // 7) Document totals: total = subtotal + taxTotal - discount (within rounding).
  for (const inv of salesInvoices) {
    push("document_total", `Sales invoice ${inv.invNo}`, dec(inv.subtotal) + dec(inv.taxTotal) - dec(inv.discount), dec(inv.total));
  }
  for (const inv of purchaseInvoices) {
    push("document_total", `Purchase invoice ${inv.invNo}`, dec(inv.subtotal) + dec(inv.taxTotal), dec(inv.total));
  }

  return { ok: issues.length === 0, issues };
}
