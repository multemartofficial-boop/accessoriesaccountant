import { Router } from "express";
import { prisma, withTx } from "../db";
import { logAudit } from "../middleware/audit";
import { asyncHandler, badRequest, ApiError } from "../middleware/error";
import { requireRole } from "../middleware/auth";
import { nextDocNumber } from "../services/numbering";
import { postStockTransfer } from "../services/posting";

export const warehousesRouter = Router();
const MODULE = "Warehouses";

warehousesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.warehouse.findMany({
        include: { _count: { select: { stockBalances: true } } },
        orderBy: { code: "asc" },
      }),
    );
  }),
);

warehousesRouter.post(
  "/",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { name, location, manager } = req.body ?? {};
    if (!name) badRequest("name is required");
    const count = await prisma.warehouse.count();
    const code = `WH-${String(count + 1).padStart(2, "0")}`;
    const warehouse = await prisma.warehouse.create({ data: { code, name, location, manager } });
    await logAudit({ action: "CREATE", module: MODULE, recordId: code, after: warehouse, req });
    res.status(201).json(warehouse);
  }),
);

warehousesRouter.put(
  "/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.warehouse.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Warehouse not found");
    const { name, location, manager, status } = req.body ?? {};
    const warehouse = await prisma.warehouse.update({ where: { id }, data: { name, location, manager, status } });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: before.code, before, after: warehouse, req });
    res.json(warehouse);
  }),
);

// Warehouse-wise stock.
warehousesRouter.get(
  "/:id/stock",
  asyncHandler(async (req, res) => {
    res.json(
      await prisma.stockBalance.findMany({
        where: { warehouseId: Number(req.params.id) },
        include: { product: { include: { unit: true, category: true } } },
      }),
    );
  }),
);

// ── Transfers ──

warehousesRouter.get(
  "/transfers/list",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.stockTransfer.findMany({
        include: { product: true, fromWarehouse: true, toWarehouse: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  }),
);

// Transfers always pass through approval (stock leaves one site before
// arriving at the other — a second pair of eyes is the control).
warehousesRouter.post(
  "/transfers",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { fromWarehouseId, toWarehouseId, productId, quantity, transferDate, notes } = req.body ?? {};
    if (!fromWarehouseId || !toWarehouseId || !productId || !quantity) {
      badRequest("fromWarehouseId, toWarehouseId, productId and quantity are required");
    }
    if (fromWarehouseId === toWarehouseId) badRequest("Source and destination must differ");

    const transfer = await withTx(async (tx) => {
      const transferNo = await nextDocNumber(tx, "stock_transfer", "TRF");
      const created = await tx.stockTransfer.create({
        data: {
          transferNo,
          fromWarehouseId: Number(fromWarehouseId),
          toWarehouseId: Number(toWarehouseId),
          productId: Number(productId),
          quantity,
          transferDate: transferDate ? new Date(transferDate) : new Date(),
          notes,
          status: "PENDING",
          approvalStatus: "AWAITING_APPROVAL",
          createdById: req.user?.id,
        },
      });
      await tx.approvalRequest.create({
        data: {
          entityType: "STOCK_TRANSFER",
          entityId: created.id,
          entityRef: transferNo,
          reason: `Transfer ${quantity} units`,
          requestedById: req.user?.id,
        },
      });
      await logAudit({ action: "CREATE", module: MODULE, recordId: transferNo, after: created, req }, tx);
      return created;
    });
    res.status(201).json(transfer);
  }),
);

// Direct complete shortcut for admins (still logged).
warehousesRouter.post(
  "/transfers/:id/complete",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const t = await prisma.stockTransfer.findUnique({ where: { id } });
    if (!t) throw new ApiError(404, "Transfer not found");
    if (t.status === "COMPLETED") badRequest("Transfer already completed");

    await withTx(async (tx) => {
      await postStockTransfer(tx, id);
      await tx.stockTransfer.update({
        where: { id },
        data: { status: "COMPLETED", approvalStatus: "APPROVED" },
      });
      await logAudit({ action: "APPROVE", module: MODULE, recordId: t.transferNo, req }, tx);
    });
    res.json({ completed: true });
  }),
);
