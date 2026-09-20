import { Prisma } from "../generated/prisma/client";
import type { Tx } from "../db";

interface BuyerLedgerInput {
  buyerId: number;
  date?: Date;
  refType: string;
  refId: number;
  refNo?: string;
  description?: string;
  debit?: number | Prisma.Decimal; // raises receivable
  credit?: number | Prisma.Decimal; // lowers receivable
}

// Writes a buyer ledger row and keeps buyer.outstanding in sync.
export async function postBuyerLedger(tx: Tx, input: BuyerLedgerInput) {
  const buyer = await tx.buyer.findUniqueOrThrow({ where: { id: input.buyerId } });
  const balance = buyer.outstanding.plus(input.debit ?? 0).minus(input.credit ?? 0);

  await tx.buyerLedgerEntry.create({
    data: { ...input, debit: input.debit ?? 0, credit: input.credit ?? 0, balanceAfter: balance },
  });
  await tx.buyer.update({ where: { id: input.buyerId }, data: { outstanding: balance } });
  return balance;
}

interface SupplierLedgerInput {
  supplierId: number;
  date?: Date;
  refType: string;
  refId: number;
  refNo?: string;
  description?: string;
  debit?: number | Prisma.Decimal; // lowers payable
  credit?: number | Prisma.Decimal; // raises payable
}

export async function postSupplierLedger(tx: Tx, input: SupplierLedgerInput) {
  const supplier = await tx.supplier.findUniqueOrThrow({ where: { id: input.supplierId } });
  const balance = supplier.payable.minus(input.debit ?? 0).plus(input.credit ?? 0);

  await tx.supplierLedgerEntry.create({
    data: { ...input, debit: input.debit ?? 0, credit: input.credit ?? 0, balanceAfter: balance },
  });
  await tx.supplier.update({ where: { id: input.supplierId }, data: { payable: balance } });
  return balance;
}
