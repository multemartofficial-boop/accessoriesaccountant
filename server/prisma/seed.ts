// Seed: reference data only — no demo parties, products or transactions,
// the client starts on an empty workspace.
// Run with: npm run db:seed
import bcrypt from "bcryptjs";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/db";

async function main() {
  console.log("Seeding…");

  // ── Chart of accounts ──
  const accounts = [
    { code: "1100", name: "Cash in hand", category: "ASSET" },
    { code: "1110", name: "Bank accounts", category: "ASSET" },
    { code: "1200", name: "Inventory", category: "ASSET" },
    { code: "1300", name: "Trade receivable", category: "ASSET" },
    { code: "2100", name: "Trade payable", category: "LIABILITY" },
    { code: "2200", name: "VAT payable (output)", category: "LIABILITY" },
    { code: "2300", name: "Input VAT reclaimable", category: "ASSET" },
    { code: "3100", name: "Owner's equity", category: "EQUITY" },
    { code: "4100", name: "Sales revenue", category: "INCOME" },
    { code: "4900", name: "Other income", category: "INCOME" },
    { code: "5100", name: "Cost of goods sold", category: "EXPENSE" },
    { code: "5200", name: "Sales returns", category: "EXPENSE" },
    { code: "5300", name: "Operating expense", category: "EXPENSE" },
  ] as const;
  for (const a of accounts) {
    await prisma.account.upsert({
      where: { code: a.code },
      create: { ...a, isSystem: true },
      update: {},
    });
  }

  // ── Settings & company profile ──
  const settings: Record<string, string> = {
    currency: "BDT",
    vat_mode: "EXCLUSIVE",
    approval_threshold: "100000",
    notify_low_stock: "true",
    notify_approvals: "true",
    doc_invoice_terms:
      "1. Payment due within the agreed terms.\n2. Please include the invoice number on your cheque.",
    doc_invoice_footer: "Thank you for your business!",
    doc_chalan_notes: "Received the above goods in good order and condition.",
    doc_chalan_type: "Delivery",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  await prisma.companyProfile.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      name: "RAHMAN'S LABEL",
      legalName: "RAHMAN'S LABEL",
      address: "Tejgaon Industrial Area, Dhaka 1208",
      phone: "+880 2 8877665",
      email: "info@rahmanslabel.com",
      vatRegNo: "004567890-0101",
    },
    update: {},
  });

  // ── Document sequences ──
  const seqs = [
    { docType: "buyer_code", prefix: "BUY", padding: 3, yearInfix: false },
    { docType: "supplier_code", prefix: "SUP", padding: 3, yearInfix: false },
    { docType: "purchase_order", prefix: "PO", padding: 3 },
    { docType: "purchase_invoice", prefix: "PI", padding: 3 },
    { docType: "sales_order", prefix: "SO", padding: 3 },
    { docType: "sales_invoice", prefix: "INV", padding: 3 },
    { docType: "delivery_chalan", prefix: "DC", padding: 3 },
    { docType: "supplier_payment", prefix: "PAY", padding: 3 },
    { docType: "payment_collection", prefix: "RCV", padding: 3 },
    { docType: "sales_return", prefix: "SR", padding: 3 },
    { docType: "stock_adjustment", prefix: "ADJ", padding: 3 },
    { docType: "stock_transfer", prefix: "TRF", padding: 3 },
    { docType: "cash_transaction", prefix: "TXN", padding: 3 },
    { docType: "journal_entry", prefix: "JE", padding: 3 },
  ];
  for (const s of seqs) {
    await prisma.documentSequence.upsert({ where: { docType: s.docType }, create: s, update: {} });
  }

  // ── Users ──
  const users = [
    {
      name: "Sharfin",
      email: "sharfin82@gmail.com",
      role: "ADMIN",
      location: "Dhaka",
      pw: "sharfin@246#",
    },
  ] as const;
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        name: u.name,
        email: u.email,
        role: u.role,
        location: u.location,
        passwordHash: await bcrypt.hash(u.pw, 10),
      },
      update: {},
    });
  }

  // ── Units & tax rates (needed before products can be created) ──
  const units = [
    { name: "Piece", code: "PCS" },
    { name: "Meter", code: "MTR" },
    { name: "Roll", code: "ROLL" },
    { name: "Gross", code: "GRS" },
  ];
  for (const u of units)
    await prisma.unit.upsert({ where: { code: u.code }, create: u, update: {} });

  const taxRates = [
    { name: "Standard VAT", code: "VAT-STD", ratePercent: 5, type: "BOTH" },
    { name: "Zero-rated export", code: "VAT-ZERO", ratePercent: 0, type: "OUTPUT" },
    { name: "Withholding tax", code: "TAX-WHT", ratePercent: 3, type: "DEDUCTION" },
  ] as const;
  for (const t of taxRates) {
    await prisma.taxRate.upsert({
      where: { code: t.code },
      create: { ...t, ratePercent: new Prisma.Decimal(t.ratePercent), type: t.type as never },
      update: {},
    });
  }

  console.log("Seed complete.");
  console.log("Login: sharfin82@gmail.com / sharfin@246#");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
