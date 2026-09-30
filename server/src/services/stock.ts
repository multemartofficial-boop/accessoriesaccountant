import { Prisma } from "../generated/prisma/client";
import { ApiError } from "../middleware/error";
import type { Tx } from "../db";

interface StockMoveInput {
  productId: number;
  warehouseId: number;
  type: "IN" | "OUT" | "ADJUST" | "TRANSFER_OUT" | "TRANSFER_IN" | "RETURN_IN";
  quantity: number | Prisma.Decimal; // signed: +in / -out
  unitCost?: number | Prisma.Decimal;
  refType?: string;
  refId?: number;
  refNo?: string;
  reason?: string;
  createdById?: number;
  allowNegative?: boolean;
}

// Single funnel for every stock change: updates StockBalance and writes
// an immutable StockMovement row with the resulting balance.
export async function applyStockMovement(tx: Tx, input: StockMoveInput) {
  const qty = new Prisma.Decimal(input.quantity);
  if (qty.isZero() || !qty.isFinite()) {
    throw new ApiError(400, "Stock movement quantity must be non-zero");
  }

  const balance = await tx.stockBalance.upsert({
    where: {
      productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId },
    },
    create: { productId: input.productId, warehouseId: input.warehouseId, quantity: 0 },
    update: {},
  });

  const newQty = balance.quantity.plus(qty);
  if (newQty.lt(0) && !input.allowNegative) {
    throw new ApiError(
      400,
      `Insufficient stock for product ${input.productId} in warehouse ${input.warehouseId}`,
    );
  }

  const updated = await tx.stockBalance.update({
    where: { id: balance.id },
    data: { quantity: newQty },
  });

  await tx.stockMovement.create({
    data: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: input.type,
      quantity: qty,
      unitCost: input.unitCost,
      refType: input.refType,
      refId: input.refId,
      refNo: input.refNo,
      reason: input.reason,
      qtyAfter: newQty,
      createdById: input.createdById,
    },
  });

  return updated;
}

// Batched variant for multi-line documents against one warehouse: one balance
// read, one update per line, one movement insert — instead of 3 queries per line.
// Balances may go negative (documents are issued ahead of stock intake).
export async function applyStockMovements(
  tx: Tx,
  warehouseId: number,
  lines: { productId: number; quantity: number | Prisma.Decimal }[],
  meta: Pick<StockMoveInput, "type" | "refType" | "refId" | "refNo" | "reason" | "createdById">,
) {
  const merged = new Map<number, Prisma.Decimal>();
  for (const l of lines) {
    const qty = new Prisma.Decimal(l.quantity);
    if (qty.isZero() || !qty.isFinite())
      throw new ApiError(400, "Stock movement quantity must be non-zero");
    merged.set(l.productId, (merged.get(l.productId) ?? new Prisma.Decimal(0)).plus(qty));
  }
  const productIds = [...merged.keys()];
  const existing = await tx.stockBalance.findMany({
    where: { warehouseId, productId: { in: productIds } },
  });
  const byProduct = new Map(existing.map((b) => [b.productId, b]));

  const missing = productIds.filter((id) => !byProduct.has(id));
  if (missing.length) {
    await tx.stockBalance.createMany({
      data: missing.map((productId) => ({ productId, warehouseId, quantity: 0 })),
      skipDuplicates: true,
    });
  }

  const movements: Prisma.StockMovementCreateManyInput[] = [];
  for (const [productId, qty] of merged) {
    const current = byProduct.get(productId)?.quantity ?? new Prisma.Decimal(0);
    const newQty = current.plus(qty);
    await tx.stockBalance.update({
      where: { productId_warehouseId: { productId, warehouseId } },
      data: { quantity: newQty },
    });
    movements.push({
      productId,
      warehouseId,
      type: meta.type,
      quantity: qty,
      refType: meta.refType,
      refId: meta.refId,
      refNo: meta.refNo,
      reason: meta.reason,
      qtyAfter: newQty,
      createdById: meta.createdById,
    });
  }
  await tx.stockMovement.createMany({ data: movements });
}

// Products whose total stock (all warehouses) is below minStock.
export async function lowStockProducts(tx: Tx) {
  const products = await tx.product.findMany({
    where: { status: "ACTIVE" },
    include: { stockBalances: { include: { warehouse: true } }, unit: true, category: true },
  });
  return products
    .map((p) => {
      const total = p.stockBalances.reduce((sum, b) => sum.plus(b.quantity), new Prisma.Decimal(0));
      return { ...p, totalStock: total, balances: p.stockBalances };
    })
    .filter((p) => p.totalStock.lt(p.minStock));
}
