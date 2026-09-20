import { Router } from "express";
import { prisma, withTx } from "../db";
import { logAudit } from "../middleware/audit";
import { asyncHandler, ApiError } from "../middleware/error";
import { requireRole } from "../middleware/auth";
import {
  postCollection,
  postStockAdjustment,
  postStockTransfer,
  postSupplierPayment,
} from "../services/posting";

export const approvalsRouter = Router();
const MODULE = "Approvals";

approvalsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? "AWAITING_APPROVAL");
    const requests = await prisma.approvalRequest.findMany({
      where: status === "ALL" ? {} : { status: status as never },
      include: { requestedBy: { select: { id: true, name: true } }, decidedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Hydrate the queued entities so the UI can render real detail.
    const hydrated = await Promise.all(
      requests.map(async (r) => {
        let entity: unknown = null;
        try {
          switch (r.entityType) {
            case "PURCHASE_ORDER":
              entity = await prisma.purchaseOrder.findUnique({
                where: { id: r.entityId },
                include: { supplier: true, items: { include: { product: true } } },
              });
              break;
            case "SALES_ORDER":
            case "SALES_DISCOUNT":
              entity = await prisma.salesOrder.findUnique({
                where: { id: r.entityId },
                include: { buyer: true, items: { include: { product: true } } },
              });
              break;
            case "SUPPLIER_PAYMENT":
              entity = await prisma.supplierPayment.findUnique({
                where: { id: r.entityId },
                include: { supplier: true, account: true, invoice: true },
              });
              break;
            case "PAYMENT_COLLECTION":
              entity = await prisma.paymentCollection.findUnique({
                where: { id: r.entityId },
                include: { buyer: true, account: true, invoice: true },
              });
              break;
            case "STOCK_ADJUSTMENT":
              entity = await prisma.stockAdjustment.findUnique({
                where: { id: r.entityId },
                include: { product: true, warehouse: true },
              });
              break;
            case "STOCK_TRANSFER":
              entity = await prisma.stockTransfer.findUnique({
                where: { id: r.entityId },
                include: { product: true, fromWarehouse: true, toWarehouse: true },
              });
              break;
          }
        } catch {
          entity = null;
        }
        return { ...r, entity };
      }),
    );
    res.json(hydrated);
  }),
);

approvalsRouter.post(
  "/:id/approve",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const request = await prisma.approvalRequest.findUnique({ where: { id } });
    if (!request) throw new ApiError(404, "Approval request not found");
    if (request.status !== "AWAITING_APPROVAL") throw new ApiError(400, "Request already decided");

    await withTx(async (tx) => {
      const eid = request.entityId;
      switch (request.entityType) {
        case "PURCHASE_ORDER":
          await tx.purchaseOrder.update({ where: { id: eid }, data: { status: "APPROVED", approvalStatus: "APPROVED" } });
          break;
        case "SALES_ORDER":
        case "SALES_DISCOUNT":
          await tx.salesOrder.update({ where: { id: eid }, data: { status: "APPROVED", approvalStatus: "APPROVED" } });
          break;
        case "SUPPLIER_PAYMENT":
          await tx.supplierPayment.update({ where: { id: eid }, data: { approvalStatus: "APPROVED" } });
          await postSupplierPayment(tx, eid);
          break;
        case "PAYMENT_COLLECTION":
          await tx.paymentCollection.update({ where: { id: eid }, data: { approvalStatus: "APPROVED" } });
          await postCollection(tx, eid);
          break;
        case "STOCK_ADJUSTMENT":
          await tx.stockAdjustment.update({ where: { id: eid }, data: { approvalStatus: "APPROVED" } });
          await postStockAdjustment(tx, eid);
          break;
        case "STOCK_TRANSFER":
          await tx.stockTransfer.update({ where: { id: eid }, data: { status: "COMPLETED", approvalStatus: "APPROVED" } });
          await postStockTransfer(tx, eid);
          break;
      }
      await tx.approvalRequest.update({
        where: { id },
        data: { status: "APPROVED", decidedById: req.user?.id, decidedAt: new Date(), decisionNote: req.body?.note },
      });
      await logAudit(
        { action: "APPROVE", module: MODULE, recordId: request.entityRef ?? request.entityId, req },
        tx,
      );
    });
    res.json({ approved: true });
  }),
);

approvalsRouter.post(
  "/:id/decline",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const request = await prisma.approvalRequest.findUnique({ where: { id } });
    if (!request) throw new ApiError(404, "Approval request not found");
    if (request.status !== "AWAITING_APPROVAL") throw new ApiError(400, "Request already decided");

    await withTx(async (tx) => {
      const eid = request.entityId;
      switch (request.entityType) {
        case "PURCHASE_ORDER":
          await tx.purchaseOrder.update({ where: { id: eid }, data: { status: "CANCELLED", approvalStatus: "DECLINED" } });
          break;
        case "SALES_ORDER":
        case "SALES_DISCOUNT":
          await tx.salesOrder.update({ where: { id: eid }, data: { status: "CANCELLED", approvalStatus: "DECLINED" } });
          break;
        case "SUPPLIER_PAYMENT":
          await tx.supplierPayment.update({ where: { id: eid }, data: { approvalStatus: "DECLINED" } });
          break;
        case "PAYMENT_COLLECTION":
          await tx.paymentCollection.update({ where: { id: eid }, data: { approvalStatus: "DECLINED" } });
          break;
        case "STOCK_ADJUSTMENT":
          await tx.stockAdjustment.update({ where: { id: eid }, data: { approvalStatus: "DECLINED" } });
          break;
        case "STOCK_TRANSFER":
          await tx.stockTransfer.update({ where: { id: eid }, data: { status: "DECLINED", approvalStatus: "DECLINED" } });
          break;
      }
      await tx.approvalRequest.update({
        where: { id },
        data: { status: "DECLINED", decidedById: req.user?.id, decidedAt: new Date(), decisionNote: req.body?.note },
      });
      await logAudit(
        { action: "DECLINE", module: MODULE, recordId: request.entityRef ?? request.entityId, req },
        tx,
      );
    });
    res.json({ declined: true });
  }),
);
