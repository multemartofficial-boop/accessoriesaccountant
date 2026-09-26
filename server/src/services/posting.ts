import { ApiError } from "../middleware/error";
import type { Tx } from "../db";
import { postBuyerLedger, postSupplierLedger } from "./ledger";
import { postJournal } from "./journal";
import { applyStockMovement } from "./stock";
import { nextDocNumber } from "./numbering";

// GL account codes (seeded):
// 1100 Cash, 1110 Bank, 1200 Inventory, 1300 Trade Receivable, 2100 Trade Payable,
// 2200 VAT Payable, 4100 Sales Revenue, 5100 COGS, 5200 Sales Return

// Guards against a document whose stored totals don't match its lines — the
// API recomputes totals on write, this is a last-line defence inside the tx.
function assertDocumentTotals(inv: { subtotal: unknown; taxTotal: unknown; discount?: unknown; total: unknown }, ref: string) {
  const expected = Number(inv.subtotal) + Number(inv.taxTotal) - Number(inv.discount ?? 0);
  if (Math.abs(expected - Number(inv.total)) > 0.01) {
    throw new ApiError(500, `Inconsistent totals on ${ref}: ${expected} vs stored ${inv.total}`);
  }
}

// ── Purchase invoice post: stock IN + supplier payable + journal ──
export async function postPurchaseInvoice(tx: Tx, invoiceId: number) {
  const inv = await tx.purchaseInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: { include: { product: true } } },
  });
  assertDocumentTotals(inv, `purchase invoice ${inv.invNo}`);

  for (const item of inv.items) {
    await applyStockMovement(tx, {
      productId: item.productId,
      warehouseId: inv.warehouseId,
      type: "IN",
      quantity: item.quantity,
      unitCost: item.rate,
      refType: "purchase_invoice",
      refId: inv.id,
      refNo: inv.invNo,
      createdById: inv.createdById ?? undefined,
    });
  }

  await postSupplierLedger(tx, {
    supplierId: inv.supplierId,
    date: inv.invoiceDate,
    refType: "purchase_invoice",
    refId: inv.id,
    refNo: inv.invNo,
    description: `Purchase invoice ${inv.invNo}`,
    credit: inv.total,
  });

  await postJournal(tx, {
    date: inv.invoiceDate,
    memo: `Purchase ${inv.invNo}`,
    refType: "purchase_invoice",
    refId: inv.id,
    lines: [
      { accountCode: "1200", debit: Number(inv.subtotal) },
      ...(Number(inv.taxTotal) > 0 ? [{ accountCode: "2300", debit: Number(inv.taxTotal) }] : []), // input VAT reclaimable
      { accountCode: "2100", credit: Number(inv.total), partyType: "supplier" as const, partyId: inv.supplierId },
    ],
  });

  // Roll received quantities back onto the source PO, if any.
  if (inv.orderId) {
    const orderItems = await tx.purchaseOrderItem.findMany({ where: { orderId: inv.orderId } });
    for (const item of inv.items) {
      const poItem = orderItems.find((o) => o.productId === item.productId);
      if (poItem) {
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQty: poItem.receivedQty.plus(item.quantity) },
        });
      }
    }
    const refreshed = await tx.purchaseOrderItem.findMany({ where: { orderId: inv.orderId } });
    const allDone = refreshed.every((i) => i.receivedQty.gte(i.quantity));
    const anyDone = refreshed.some((i) => i.receivedQty.gt(0));
    await tx.purchaseOrder.update({
      where: { id: inv.orderId },
      data: { status: allDone ? "COMPLETED" : anyDone ? "PARTIAL" : undefined },
    });
  }
}

// ── Supplier payment post: cash out + payable down + journal ──
export async function postSupplierPayment(tx: Tx, paymentId: number) {
  const payment = await tx.supplierPayment.findUniqueOrThrow({ where: { id: paymentId } });

  await applyCashTransaction(tx, {
    accountId: payment.accountId,
    type: "PAYMENT",
    amount: Number(payment.amount),
    date: payment.date,
    particulars: `Supplier payment ${payment.paymentNo}`,
    reference: payment.reference ?? undefined,
    refType: "supplier_payment",
    refId: payment.id,
    createdById: payment.createdById ?? undefined,
  });

  await postSupplierLedger(tx, {
    supplierId: payment.supplierId,
    date: payment.date,
    refType: "supplier_payment",
    refId: payment.id,
    refNo: payment.paymentNo,
    description: `Payment ${payment.paymentNo}${payment.method ? ` via ${payment.method}` : ""}`,
    debit: payment.amount,
  });

  if (payment.invoiceId) {
    const inv = await tx.purchaseInvoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
    const paid = inv.paidAmount.plus(payment.amount);
    await tx.purchaseInvoice.update({
      where: { id: inv.id },
      data: { paidAmount: paid, status: paid.gte(inv.total) ? "PAID" : "PARTIAL" },
    });
  }

  const account = await tx.cashAccount.findUniqueOrThrow({ where: { id: payment.accountId } });
  await postJournal(tx, {
    date: payment.date,
    memo: `Supplier payment ${payment.paymentNo}`,
    refType: "supplier_payment",
    refId: payment.id,
    lines: [
      { accountCode: "2100", debit: Number(payment.amount), partyType: "supplier", partyId: payment.supplierId },
      { accountCode: account.type === "CASH" ? "1100" : "1110", credit: Number(payment.amount) },
    ],
  });
}

// ── Delivery chalan post: stock OUT ──
export async function postDeliveryChalan(tx: Tx, chalanId: number) {
  const chalan = await tx.deliveryChalan.findUniqueOrThrow({
    where: { id: chalanId },
    include: { items: true },
  });
  for (const item of chalan.items) {
    await applyStockMovement(tx, {
      productId: item.productId,
      warehouseId: chalan.warehouseId,
      type: "OUT",
      quantity: item.quantity.neg(),
      refType: "delivery_chalan",
      refId: chalan.id,
      refNo: chalan.dcNo,
      createdById: chalan.createdById ?? undefined,
    });
    if (chalan.salesOrderId) {
      const soItem = await tx.salesOrderItem.findFirst({
        where: { orderId: chalan.salesOrderId, productId: item.productId },
      });
      if (soItem) {
        await tx.salesOrderItem.update({
          where: { id: soItem.id },
          data: { deliveredQty: soItem.deliveredQty.plus(item.quantity) },
        });
      }
    }
  }
  if (chalan.salesOrderId) {
    const items = await tx.salesOrderItem.findMany({ where: { orderId: chalan.salesOrderId } });
    const allDone = items.every((i) => i.deliveredQty.gte(i.quantity));
    await tx.salesOrder.update({
      where: { id: chalan.salesOrderId },
      data: { status: allDone ? "COMPLETED" : "PARTIAL" },
    });
  }
}

// ── Sales invoice post: receivable up + journal ──
export async function postSalesInvoice(tx: Tx, invoiceId: number) {
  const inv = await tx.salesInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: true },
  });
  assertDocumentTotals(inv, `sales invoice ${inv.invNo}`);

  await postBuyerLedger(tx, {
    buyerId: inv.buyerId,
    date: inv.invoiceDate,
    refType: "sales_invoice",
    refId: inv.id,
    refNo: inv.invNo,
    description: `Sales invoice ${inv.invNo}`,
    debit: inv.total,
  });

  // COGS from current purchase price (moving average would need a cost layer —
  // purchase price is the documented approximation for this build).
  let cogs = 0;
  for (const item of inv.items) {
    const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
    cogs += Number(product.purchasePrice) * Number(item.quantity);
  }

  await postJournal(tx, {
    date: inv.invoiceDate,
    memo: `Sales invoice ${inv.invNo}`,
    refType: "sales_invoice",
    refId: inv.id,
    lines: [
      { accountCode: "1300", debit: Number(inv.total), partyType: "buyer", partyId: inv.buyerId },
      { accountCode: "4100", credit: Number(inv.subtotal) - Number(inv.discount) },
      ...(Number(inv.taxTotal) > 0 ? [{ accountCode: "2200", credit: Number(inv.taxTotal) }] : []),
      { accountCode: "5100", debit: cogs },
      { accountCode: "1200", credit: cogs },
    ],
  });
}

// ── Sales return post: stock IN + receivable down + journal reversal ──
export async function postSalesReturn(tx: Tx, returnId: number) {
  const ret = await tx.salesReturn.findUniqueOrThrow({
    where: { id: returnId },
    include: { items: true },
  });
  for (const item of ret.items) {
    await applyStockMovement(tx, {
      productId: item.productId,
      warehouseId: ret.warehouseId,
      type: "RETURN_IN",
      quantity: item.quantity,
      unitCost: item.rate,
      refType: "sales_return",
      refId: ret.id,
      refNo: ret.returnNo,
      reason: ret.reason ?? undefined,
      createdById: ret.createdById ?? undefined,
    });
  }

  await postBuyerLedger(tx, {
    buyerId: ret.buyerId,
    date: ret.date,
    refType: "sales_return",
    refId: ret.id,
    refNo: ret.returnNo,
    description: `Sales return ${ret.returnNo}`,
    credit: ret.total,
  });

  // Restocking reverses the cost side too: Inventory up, COGS down.
  let cogs = 0;
  for (const item of ret.items) {
    const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
    cogs += Number(product.purchasePrice) * Number(item.quantity);
  }

  await postJournal(tx, {
    date: ret.date,
    memo: `Sales return ${ret.returnNo}`,
    refType: "sales_return",
    refId: ret.id,
    lines: [
      { accountCode: "5200", debit: Number(ret.total) },
      { accountCode: "1300", credit: Number(ret.total), partyType: "buyer", partyId: ret.buyerId },
      ...(cogs > 0
        ? [
            { accountCode: "1200", debit: cogs },
            { accountCode: "5100", credit: cogs },
          ]
        : []),
    ],
  });
}

// ── Payment collection post: cash in + receivable down + journal ──
export async function postCollection(tx: Tx, collectionId: number) {
  const col = await tx.paymentCollection.findUniqueOrThrow({ where: { id: collectionId } });

  await applyCashTransaction(tx, {
    accountId: col.accountId,
    type: "RECEIPT",
    amount: Number(col.amount),
    date: col.date,
    particulars: `Collection ${col.collectionNo}`,
    reference: col.reference ?? undefined,
    refType: "collection",
    refId: col.id,
    createdById: col.createdById ?? undefined,
  });

  await postBuyerLedger(tx, {
    buyerId: col.buyerId,
    date: col.date,
    refType: "collection",
    refId: col.id,
    refNo: col.collectionNo,
    description: `Payment received ${col.collectionNo}${col.method ? ` via ${col.method}` : ""}`,
    credit: col.amount,
  });

  if (col.invoiceId) {
    const inv = await tx.salesInvoice.findUniqueOrThrow({ where: { id: col.invoiceId } });
    const paid = inv.paidAmount.plus(col.amount);
    await tx.salesInvoice.update({
      where: { id: inv.id },
      data: { paidAmount: paid, status: paid.gte(inv.total) ? "PAID" : "PARTIAL" },
    });
  }

  const account = await tx.cashAccount.findUniqueOrThrow({ where: { id: col.accountId } });
  await postJournal(tx, {
    date: col.date,
    memo: `Collection ${col.collectionNo}`,
    refType: "collection",
    refId: col.id,
    lines: [
      { accountCode: account.type === "CASH" ? "1100" : "1110", debit: Number(col.amount) },
      { accountCode: "1300", credit: Number(col.amount), partyType: "buyer", partyId: col.buyerId },
    ],
  });
}

// ── Stock adjustment post ──
export async function postStockAdjustment(tx: Tx, adjId: number) {
  const adj = await tx.stockAdjustment.findUniqueOrThrow({ where: { id: adjId } });
  await applyStockMovement(tx, {
    productId: adj.productId,
    warehouseId: adj.warehouseId,
    type: "ADJUST",
    quantity: adj.quantity,
    unitCost: adj.unitCost ?? undefined,
    refType: "adjustment",
    refId: adj.id,
    refNo: adj.adjNo,
    reason: adj.reason,
    createdById: adj.createdById ?? undefined,
  });
}

// ── Stock transfer post: out of source, into destination ──
export async function postStockTransfer(tx: Tx, transferId: number) {
  const t = await tx.stockTransfer.findUniqueOrThrow({ where: { id: transferId } });
  const base = {
    productId: t.productId,
    refType: "transfer" as const,
    refId: t.id,
    refNo: t.transferNo,
    createdById: t.createdById ?? undefined,
  };
  await applyStockMovement(tx, { ...base, warehouseId: t.fromWarehouseId, type: "TRANSFER_OUT", quantity: t.quantity.neg() });
  await applyStockMovement(tx, { ...base, warehouseId: t.toWarehouseId, type: "TRANSFER_IN", quantity: t.quantity });
}

// ── Cash/bank ledger writer — single funnel for account balance changes ──
export async function applyCashTransaction(
  tx: Tx,
  input: {
    accountId: number;
    toAccountId?: number;
    type: "RECEIPT" | "PAYMENT" | "TRANSFER" | "ADJUSTMENT";
    // Only meaningful for ADJUSTMENT: "IN" increases the balance,
    // anything else (default) decreases it.
    direction?: "IN" | "OUT";
    amount: number;
    date?: Date;
    particulars?: string;
    reference?: string;
    refType?: string;
    refId?: number;
    createdById?: number;
  },
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ApiError(400, "Transaction amount must be a positive number");
  }
  const account = await tx.cashAccount.findUniqueOrThrow({ where: { id: input.accountId } });
  const inbound =
    input.type === "RECEIPT" || (input.type === "ADJUSTMENT" && input.direction === "IN");
  const delta = inbound ? input.amount : -input.amount;
  const newBalance = account.balance.plus(delta);

  let txnNo = await nextDocNumber(tx, "cash_transaction", "TXN");
  // Same "-IN" convention as transfer mirror legs: marks the row as inbound
  // for the ledger view and the cash integrity check.
  if (input.type === "ADJUSTMENT" && input.direction === "IN") txnNo = `${txnNo}-IN`;
  const txn = await tx.cashTransaction.create({
    data: {
      txnNo,
      accountId: input.accountId,
      toAccountId: input.toAccountId,
      type: input.type,
      amount: input.amount,
      date: input.date ?? new Date(),
      particulars: input.particulars,
      reference: input.reference,
      refType: input.refType,
      refId: input.refId,
      balanceAfter: newBalance,
      createdById: input.createdById,
    },
  });
  await tx.cashAccount.update({ where: { id: input.accountId }, data: { balance: newBalance } });

  // Mirror leg for transfers.
  if (input.type === "TRANSFER" && input.toAccountId) {
    const dest = await tx.cashAccount.findUniqueOrThrow({ where: { id: input.toAccountId } });
    const destBalance = dest.balance.plus(input.amount);
    await tx.cashTransaction.create({
      data: {
        txnNo: `${txnNo}-IN`,
        accountId: input.toAccountId,
        toAccountId: input.accountId,
        type: "TRANSFER",
        amount: input.amount,
        date: input.date ?? new Date(),
        particulars: input.particulars,
        reference: input.reference,
        refType: input.refType,
        refId: input.refId,
        balanceAfter: destBalance,
        createdById: input.createdById,
      },
    });
    await tx.cashAccount.update({ where: { id: input.toAccountId }, data: { balance: destBalance } });
  }
  return txn;
}
