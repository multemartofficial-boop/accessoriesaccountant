// Wipes all business data so the client starts fresh.
// Keeps: users, company profile, settings, chart of accounts,
// units, tax rates. Document sequences are reset to 0.
// A full JSON backup is written to server/backups/ before deleting.
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/db";

const KEEP = new Set([
  "User",
  "CompanyProfile",
  "Setting",
  "DocumentSequence",
  "Account",
  "Unit",
  "TaxRate",
]);

const DATA_TABLES = [
  "JournalLine",
  "JournalEntry",
  "AuditLog",
  "ApprovalRequest",
  "CashTransaction",
  "PaymentCollection",
  "SupplierPayment",
  "SalesReturnItem",
  "SalesReturn",
  "SalesInvoiceItem",
  "SalesInvoice",
  "DeliveryChalanItem",
  "DeliveryChalan",
  "SalesOrderItem",
  "SalesOrder",
  "PurchaseInvoiceItem",
  "PurchaseInvoice",
  "PurchaseOrderItem",
  "PurchaseOrder",
  "StockTransfer",
  "StockAdjustment",
  "StockMovement",
  "StockBalance",
  "BuyerLedgerEntry",
  "SupplierLedgerEntry",
  "Product",
  "Category",
  "Buyer",
  "Supplier",
  "CashAccount",
  "Warehouse",
];

async function backup() {
  const backup: Record<string, unknown> = {};
  type Delegate = { findMany?: () => Promise<unknown[]> };
  const client = prisma as unknown as Record<string, Delegate | undefined>;
  for (const name of [...KEEP, ...DATA_TABLES]) {
    const delegate = client[name[0].toLowerCase() + name.slice(1)];
    if (!delegate?.findMany) continue;
    backup[name] = await delegate.findMany();
  }
  const dir = path.resolve(process.cwd(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `db-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`,
  );
  fs.writeFileSync(
    file,
    JSON.stringify(backup, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2),
  );
  console.log(`Backup written: ${file}`);
}

async function main() {
  await backup();

  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const table of DATA_TABLES) {
      await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``);
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
      console.log(`cleared ${table}`);
    }
    await prisma.$executeRawUnsafe("UPDATE `DocumentSequence` SET `lastNumber` = 0");
    console.log("document sequences reset to 0");
  } finally {
    await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
  }

  const users = await prisma.user.findMany({ select: { email: true, role: true } });
  console.log("remaining users:", JSON.stringify(users));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
