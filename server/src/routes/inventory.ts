import { Router } from "express";
import { prisma, withTx } from "../db";
import { Prisma } from "../generated/prisma/client";
import { logAudit } from "../middleware/audit";
import { asyncHandler, badRequest, ApiError } from "../middleware/error";
import { requireRole } from "../middleware/auth";
import { nextDocNumber } from "../services/numbering";
import { maybeRequestApproval } from "../services/approval";
import { postStockAdjustment } from "../services/posting";
import { lowStockProducts } from "../services/stock";

export const inventoryRouter = Router();
const MODULE = "Inventory";

// Stock overview: every product × warehouse balance.
inventoryRouter.get(
  "/stock",
  asyncHandler(async (req, res) => {
    const balances = await prisma.stockBalance.findMany({
      where: req.query.warehouseId ? { warehouseId: Number(req.query.warehouseId) } : undefined,
      include: { product: { include: { unit: true, category: true } }, warehouse: true },
      orderBy: { product: { name: "asc" } },
    });
    res.json(
      balances.map((b) => ({
        ...b,
        status: b.quantity.lte(0)
          ? "OUT_OF_STOCK"
          : b.quantity.lt(b.product.minStock)
            ? "LOW_STOCK"
            : "IN_STOCK",
      })),
    );
  }),
);

// Per-product detail: balances + movement history.
inventoryRouter.get(
  "/stock/:productId",
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { stockBalances: { include: { warehouse: true } }, unit: true, category: true },
    });
    if (!product) throw new ApiError(404, "Product not found");
    const movements = await prisma.stockMovement.findMany({
      where: { productId },
      include: { warehouse: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ ...product, movements });
  }),
);

inventoryRouter.get(
  "/movements",
  asyncHandler(async (req, res) => {
    const { productId, warehouseId, from, to, type } = req.query;
    res.json(
      await prisma.stockMovement.findMany({
        where: {
          ...(productId && { productId: Number(productId) }),
          ...(warehouseId && { warehouseId: Number(warehouseId) }),
          ...(type && { type: String(type) as never }),
          ...((from || to) && {
            createdAt: {
              ...(from && { gte: new Date(String(from)) }),
              ...(to && { lte: new Date(String(to)) }),
            },
          }),
        },
        include: { product: true, warehouse: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    );
  }),
);

inventoryRouter.get(
  "/low-stock",
  asyncHandler(async (_req, res) => {
    res.json(await lowStockProducts(prisma));
  }),
);

inventoryRouter.post(
  "/adjustments",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { productId, warehouseId, quantity, unitCost, reason, reference } = req.body ?? {};
    if (!productId || !warehouseId || quantity === undefined || !reason) {
      badRequest("productId, warehouseId, quantity and reason are required");
    }

    const adj = await withTx(async (tx) => {
      const adjNo = await nextDocNumber(tx, "stock_adjustment", "ADJ");
      const created = await tx.stockAdjustment.create({
        data: {
          adjNo,
          productId: Number(productId),
          warehouseId: Number(warehouseId),
          quantity,
          unitCost,
          reason,
          reference,
          createdById: req.user?.id,
        },
      });

      const value = new Prisma.Decimal(quantity).abs().mul(unitCost ?? 0);
      const needsApproval = await maybeRequestApproval(tx, {
        entityType: "STOCK_ADJUSTMENT",
        entityId: created.id,
        entityRef: adjNo,
        amount: value,
        reason,
        requestedById: req.user?.id,
      });
      if (needsApproval) {
        await tx.stockAdjustment.update({ where: { id: created.id }, data: { approvalStatus: "AWAITING_APPROVAL" } });
      } else {
        await tx.stockAdjustment.update({ where: { id: created.id }, data: { approvalStatus: "APPROVED" } });
        await postStockAdjustment(tx, created.id);
      }
      await logAudit({ action: "CREATE", module: MODULE, recordId: adjNo, after: created, req }, tx);
      return created;
    });
    res.status(201).json(adj);
  }),
);

inventoryRouter.get(
  "/adjustments",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.stockAdjustment.findMany({
        include: { product: true, warehouse: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  }),
);
