import { Prisma } from "../generated/prisma/client";
import type { Tx } from "../db";

type ApprovalEntityType =
  | "PURCHASE_ORDER"
  | "SALES_ORDER"
  | "SALES_DISCOUNT"
  | "STOCK_ADJUSTMENT"
  | "SUPPLIER_PAYMENT"
  | "PAYMENT_COLLECTION"
  | "STOCK_TRANSFER";

async function threshold(tx: Tx): Promise<Prisma.Decimal> {
  const row = await tx.setting.findUnique({ where: { key: "approval_threshold" } });
  return new Prisma.Decimal(row?.value ?? "100000");
}

// Returns true when the entity was parked for approval. Callers set their
// own approvalStatus to AWAITING_APPROVAL when this returns true.
export async function maybeRequestApproval(
  tx: Tx,
  input: {
    entityType: ApprovalEntityType;
    entityId: number;
    entityRef?: string;
    amount?: number | Prisma.Decimal;
    reason?: string;
    requestedById?: number;
    force?: boolean; // e.g. stock adjustments always need approval
  },
): Promise<boolean> {
  const over = input.force || (input.amount != null && new Prisma.Decimal(input.amount).gt(await threshold(tx)));
  if (!over) return false;

  await tx.approvalRequest.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      entityRef: input.entityRef,
      amount: input.amount,
      reason: input.reason,
      requestedById: input.requestedById,
    },
  });
  return true;
}
