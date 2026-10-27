import { prisma } from "../src/db";

const models = [
  "user",
  "companyProfile",
  "setting",
  "documentSequence",
  "account",
  "unit",
  "taxRate",
  "category",
  "product",
  "warehouse",
  "cashAccount",
  "buyer",
  "supplier",
  "buyerLedgerEntry",
  "supplierLedgerEntry",
  "stockBalance",
  "stockMovement",
  "stockAdjustment",
  "stockTransfer",
  "purchaseOrder",
  "purchaseInvoice",
  "supplierPayment",
  "salesOrder",
  "deliveryChalan",
  "salesInvoice",
  "salesReturn",
  "paymentCollection",
  "cashTransaction",
  "approvalRequest",
  "auditLog",
  "journalEntry",
  "journalLine",
] as const;

async function main() {
  const rows: Record<string, number> = {};
  const client = prisma as unknown as Record<string, { count: () => Promise<number> }>;
  for (const m of models) rows[m] = await client[m].count();
  console.log(JSON.stringify(rows));
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  console.log("USERS:", JSON.stringify(users));
}

main().finally(() => prisma.$disconnect());
