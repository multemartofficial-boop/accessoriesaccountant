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
    where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
    create: { productId: input.productId, warehouseId: input.warehouseId, quantity: 0 },
    update: {},
  });

  const newQty = balance.quantity.plus(qty);
  if (newQty.lt(0) && !input.allowNegative) {
    throw new ApiError(400, `Insufficient stock for product ${input.productId} in warehouse ${input.warehouseId}`);
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
