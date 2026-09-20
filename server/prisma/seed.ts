// Seed: reference data + a realistic working set of transactions.
// Run with: npm run db:seed
import bcrypt from "bcryptjs";
import { Prisma } from "../src/generated/prisma/client";
import { prisma, withTx } from "../src/db";
import {
  postCollection,
  postDeliveryChalan,
  postPurchaseInvoice,
  postSalesInvoice,
  postSupplierPayment,
} from "../src/services/posting";
import { nextDocNumber } from "../src/services/numbering";

const d = (s: string) => new Date(s);

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
    await prisma.account.upsert({ where: { code: a.code }, create: { ...a, isSystem: true }, update: {} });
  }

  // ── Settings & company profile ──
  const settings: Record<string, string> = {
    currency: "BDT",
    vat_mode: "EXCLUSIVE",
    approval_threshold: "100000",
    notify_low_stock: "true",
    notify_approvals: "true",
    doc_invoice_terms: "1. Payment due within the agreed terms.\n2. Please include the invoice number on your cheque.",
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
      name: "GarmentTrade",
      legalName: "Accessories Trading Co.",
      address: "Tejgaon Industrial Area, Dhaka 1208",
      phone: "+880 2 8877665",
      email: "info@garmenttrade.com",
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
    { name: "Admin", email: "admin@garmenttrade.com", role: "ADMIN", location: "Dhaka", pw: "admin123" },
  ] as const;
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { name: u.name, email: u.email, role: u.role, location: u.location, passwordHash: await bcrypt.hash(u.pw, 10) },
      update: {},
    });
  }
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@garmenttrade.com" } });

  // ── Units, tax rates, categories ──
  const units = [
    { name: "Piece", code: "PCS" },
    { name: "Meter", code: "MTR" },
    { name: "Roll", code: "ROLL" },
    { name: "Gross", code: "GRS" },
  ];
  for (const u of units) await prisma.unit.upsert({ where: { code: u.code }, create: u, update: {} });
  const unitMap = new Map((await prisma.unit.findMany()).map((u) => [u.code, u.id]));

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
  const vatStd = await prisma.taxRate.findUniqueOrThrow({ where: { code: "VAT-STD" } });

  const categories = [
    { name: "Buttons", code: "BTN" },
    { name: "Zippers", code: "ZIP" },
    { name: "Labels", code: "LBL" },
    { name: "Elastic", code: "ELA" },
    { name: "Tapes", code: "TAP" },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { code: c.code },
      create: { ...c, taxRateId: vatStd.id },
      update: {},
    });
  }
  const catMap = new Map((await prisma.category.findMany()).map((c) => [c.code, c.id]));

  // ── Warehouses ──
  const warehouses = [
    { code: "WH-01", name: "Tejgaon", location: "Dhaka", manager: "Arif Hasan" },
    { code: "WH-02", name: "Gazipur", location: "Gazipur", manager: "Maliha Islam" },
    { code: "WH-03", name: "Narayanganj", location: "Narayanganj", manager: "Rafi Ahmed" },
  ];
  for (const w of warehouses) await prisma.warehouse.upsert({ where: { code: w.code }, create: w, update: {} });
  const whMap = new Map((await prisma.warehouse.findMany()).map((w) => [w.name, w.id]));

  // ── Cash & bank accounts ──
  const cashAccounts = [
    { name: "City Bank · Current", type: "BANK", bankName: "City Bank", accountNo: "1102003344556", openingBalance: 2184000 },
    { name: "BRAC Bank · Current", type: "BANK", bankName: "BRAC Bank", accountNo: "1501209988776", openingBalance: 1206000 },
    { name: "Head office cash", type: "CASH", openingBalance: 375000 },
    { name: "Petty cash", type: "CASH", openingBalance: 110000 },
  ] as const;
  for (const a of cashAccounts) {
    const exists = await prisma.cashAccount.findFirst({ where: { name: a.name } });
    if (!exists) {
      await prisma.cashAccount.create({
        data: { ...a, openingBalance: new Prisma.Decimal(a.openingBalance), balance: new Prisma.Decimal(a.openingBalance), type: a.type as never },
      });
    }
  }
  const cityBank = await prisma.cashAccount.findFirstOrThrow({ where: { name: "City Bank · Current" } });

  // ── Buyers ──
  const buyerSeed = [
    { code: "BUY-001", name: "Aurora Apparels Ltd.", contactPerson: "Samira Hossain", phone: "+880 1712 334455", email: "accounts@aurora.com", address: "Gazipur, Dhaka", paymentTerms: "30 days", creditLimit: 2500000 },
    { code: "BUY-002", name: "Northern Knitwear", contactPerson: "Fahim Chowdhury", phone: "+880 1811 223344", email: "fahim@northern.com", address: "Narayanganj", paymentTerms: "45 days", creditLimit: 1800000 },
    { code: "BUY-003", name: "Metro Fashions", contactPerson: "Tasnim Alam", phone: "+880 1913 445566", email: "tasnim@metro.com", address: "Dhaka", paymentTerms: "30 days", creditLimit: 3000000 },
    { code: "BUY-004", name: "Bengal Stitch Works", contactPerson: "Ruhul Amin", phone: "+880 1555 667788", email: "ruhul@bengal.com", address: "Chittagong", paymentTerms: "Cash", creditLimit: 900000 },
    { code: "BUY-005", name: "Eastern Denim Co.", contactPerson: "Sharif Uddin", phone: "+880 1719 889900", email: "sharif@eastern.com", address: "Dhaka", paymentTerms: "30 days", creditLimit: 1500000 },
    { code: "BUY-006", name: "Riviera Garments", contactPerson: "Nusrat Jahan", phone: "+880 1612 778899", email: "nusrat@riviera.com", address: "Ashulia", paymentTerms: "15 days", creditLimit: 2000000 },
  ];
  for (const b of buyerSeed) {
    await prisma.buyer.upsert({
      where: { code: b.code },
      create: { ...b, creditLimit: new Prisma.Decimal(b.creditLimit) },
      update: {},
    });
  }
  const buyerMap = new Map((await prisma.buyer.findMany()).map((b) => [b.code, b]));

  const supplierSeed = [
    { code: "SUP-011", name: "YKK Bangladesh", contactPerson: "Rashed Karim", phone: "+880 2 5566778", email: "sales@ykk-bd.com", paymentTerms: "30 days" },
    { code: "SUP-018", name: "Delta Button Industries", contactPerson: "Imran Haque", phone: "+880 2 7788990", email: "imran@deltabtn.com", paymentTerms: "Cash" },
    { code: "SUP-024", name: "Prime Label Works", contactPerson: "Nusrat Jahan", phone: "+880 2 9900112", email: "orders@primelabel.com", paymentTerms: "45 days" },
  ];
  for (const s of supplierSeed) {
    await prisma.supplier.upsert({ where: { code: s.code }, create: s, update: {} });
  }
  const supMap = new Map((await prisma.supplier.findMany()).map((s) => [s.code, s]));

  // ── Products ──
  const productSeed = [
    { sku: "BTN-SHL-18-WHT", name: "Shell Button 18L · White", cat: "BTN", unit: "PCS", color: "White", size: "18L", purchase: 2.1, sales: 2.8, min: 20000 },
    { sku: "ZIP-NYL-09-BLK", name: "Nylon Zipper 9in · Black", cat: "ZIP", unit: "PCS", color: "Black", size: "9 inch", purchase: 18, sales: 24, min: 5000 },
    { sku: "LBL-WVN-40", name: "Woven Main Label 40mm", cat: "LBL", unit: "PCS", color: "Navy", size: "40mm", purchase: 1.8, sales: 2.5, min: 30000 },
    { sku: "ELA-WOV-25", name: "Woven Elastic 25mm", cat: "ELA", unit: "MTR", color: "Natural", size: "25mm", purchase: 12, sales: 16, min: 2000 },
    { sku: "TAP-TWL-15", name: "Cotton Twill Tape 15mm", cat: "TAP", unit: "MTR", color: "Ecru", size: "15mm", purchase: 8, sales: 11, min: 1500 },
    { sku: "BTN-PLS-24-NVY", name: "Polyester Button 24L · Navy", cat: "BTN", unit: "PCS", color: "Navy", size: "24L", purchase: 1.5, sales: 2.2, min: 25000 },
    { sku: "ZIP-MTL-07-BRS", name: "Metal Zipper 7in · Brass", cat: "ZIP", unit: "PCS", color: "Brass", size: "7 inch", purchase: 32, sales: 42, min: 3000 },
    { sku: "LBL-CR-15", name: "Care Label 15mm Satin", cat: "LBL", unit: "ROLL", color: "White", size: "15mm", purchase: 240, sales: 310, min: 200 },
  ];
  for (const p of productSeed) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      create: {
        sku: p.sku,
        name: p.name,
        categoryId: catMap.get(p.cat)!,
        unitId: unitMap.get(p.unit)!,
        color: p.color,
        size: p.size,
        purchasePrice: new Prisma.Decimal(p.purchase),
        salesPrice: new Prisma.Decimal(p.sales),
        minStock: new Prisma.Decimal(p.min),
        taxRateId: vatStd.id,
      },
      update: {},
    });
  }
  const prodMap = new Map((await prisma.product.findMany()).map((p) => [p.sku, p]));

  // ── Sample transactions (posted through services so stock/ledger/journal
  //    all cascade exactly like real usage). Skip if data already exists. ──
  const existingInvoices = await prisma.purchaseInvoice.count();
  if (existingInvoices > 0) {
    console.log("Transactions already present — skipping transaction seed.");
    return;
  }

  const tejgaon = whMap.get("Tejgaon")!;
  const gazipur = whMap.get("Gazipur")!;

  await withTx(async (tx) => {
    // PO to YKK → fully received via purchase invoice.
    const po1 = await tx.purchaseOrder.create({
      data: {
        poNo: await nextDocNumber(tx, "purchase_order", "PO"),
        supplierId: supMap.get("SUP-011")!.id,
        orderDate: d("2026-09-01"),
        expectedDate: d("2026-09-08"),
        status: "APPROVED",
        approvalStatus: "APPROVED",
        subtotal: 95800,
        taxTotal: 4790,
        total: 100590,
        createdById: admin.id,
        items: {
          create: [
            { productId: prodMap.get("ZIP-NYL-09-BLK")!.id, quantity: 4200, rate: 18, taxRateId: vatStd.id, taxAmount: 3780, total: 79380 },
            { productId: prodMap.get("ZIP-MTL-07-BRS")!.id, quantity: 600, rate: 32, taxRateId: vatStd.id, taxAmount: 960, total: 20160 },
          ],
        },
      },
    });
    const pi1 = await tx.purchaseInvoice.create({
      data: {
        invNo: await nextDocNumber(tx, "purchase_invoice", "PI"),
        orderId: po1.id,
        supplierId: supMap.get("SUP-011")!.id,
        warehouseId: tejgaon,
        invoiceDate: d("2026-09-08"),
        subtotal: 94800,
        taxTotal: 4740,
        total: 99540,
        createdById: admin.id,
        items: {
          create: [
            { productId: prodMap.get("ZIP-NYL-09-BLK")!.id, quantity: 4200, rate: 18, taxRateId: vatStd.id, taxAmount: 3780, total: 79380 },
            { productId: prodMap.get("ZIP-MTL-07-BRS")!.id, quantity: 600, rate: 32, taxRateId: vatStd.id, taxAmount: 960, total: 20160 },
          ],
        },
      },
    });
    await postPurchaseInvoice(tx, pi1.id);

    // PO to Delta Button → purchase invoice into Gazipur.
    const po2 = await tx.purchaseOrder.create({
      data: {
        poNo: await nextDocNumber(tx, "purchase_order", "PO"),
        supplierId: supMap.get("SUP-018")!.id,
        orderDate: d("2026-09-02"),
        expectedDate: d("2026-09-06"),
        status: "APPROVED",
        approvalStatus: "APPROVED",
        subtotal: 145000,
        taxTotal: 7250,
        total: 152250,
        createdById: admin.id,
        items: {
          create: [
            { productId: prodMap.get("BTN-SHL-18-WHT")!.id, quantity: 50000, rate: 2.1, taxRateId: vatStd.id, taxAmount: 5250, total: 110250 },
            { productId: prodMap.get("BTN-PLS-24-NVY")!.id, quantity: 25000, rate: 1.5, taxRateId: vatStd.id, taxAmount: 1875, total: 39375 },
          ],
        },
      },
    });
    const pi2 = await tx.purchaseInvoice.create({
      data: {
        invNo: await nextDocNumber(tx, "purchase_invoice", "PI"),
        orderId: po2.id,
        supplierId: supMap.get("SUP-018")!.id,
        warehouseId: tejgaon,
        invoiceDate: d("2026-09-06"),
        subtotal: 105000,
        taxTotal: 5250,
        total: 110250,
        createdById: admin.id,
        items: {
          create: [{ productId: prodMap.get("BTN-SHL-18-WHT")!.id, quantity: 50000, rate: 2.1, taxRateId: vatStd.id, taxAmount: 5250, total: 110250 }],
        },
      },
    });
    await postPurchaseInvoice(tx, pi2.id); // PO2 stays PARTIAL

    // Labels + elastic + tape purchases.
    const pi3 = await tx.purchaseInvoice.create({
      data: {
        invNo: await nextDocNumber(tx, "purchase_invoice", "PI"),
        supplierId: supMap.get("SUP-024")!.id,
        warehouseId: gazipur,
        invoiceDate: d("2026-09-04"),
        subtotal: 170000,
        taxTotal: 8500,
        total: 178500,
        createdById: admin.id,
        items: {
          create: [
            { productId: prodMap.get("LBL-WVN-40")!.id, quantity: 80000, rate: 1.8, taxRateId: vatStd.id, taxAmount: 7200, total: 151200 },
            { productId: prodMap.get("ELA-WOV-25")!.id, quantity: 1500, rate: 12, taxRateId: vatStd.id, taxAmount: 900, total: 18900 },
            { productId: prodMap.get("TAP-TWL-15")!.id, quantity: 800, rate: 8, taxRateId: vatStd.id, taxAmount: 320, total: 6720 },
          ],
        },
      },
    });
    await postPurchaseInvoice(tx, pi3.id);

    // Supplier payment (partial, against PI-1).
    const pay1 = await tx.supplierPayment.create({
      data: {
        paymentNo: await nextDocNumber(tx, "supplier_payment", "PAY"),
        supplierId: supMap.get("SUP-011")!.id,
        invoiceId: pi1.id,
        accountId: cityBank.id,
        date: d("2026-09-10"),
        amount: 50000,
        method: "Bank transfer",
        approvalStatus: "APPROVED",
        createdById: admin.id,
      },
    });
    await postSupplierPayment(tx, pay1.id);

    // Sales order Aurora → chalan → invoice → partial collection.
    const so1 = await tx.salesOrder.create({
      data: {
        soNo: await nextDocNumber(tx, "sales_order", "SO"),
        buyerId: buyerMap.get("BUY-001")!.id,
        orderDate: d("2026-09-07"),
        dueDate: d("2026-09-14"),
        status: "APPROVED",
        approvalStatus: "APPROVED",
        subtotal: 123800,
        taxTotal: 6190,
        total: 129990,
        createdById: admin.id,
        items: {
          create: [
            { productId: prodMap.get("BTN-SHL-18-WHT")!.id, quantity: 10000, rate: 2.8, taxRateId: vatStd.id, taxAmount: 1400, total: 29400 },
            { productId: prodMap.get("ZIP-NYL-09-BLK")!.id, quantity: 4200, rate: 24, taxRateId: vatStd.id, taxAmount: 5040, total: 105840 },
          ],
        },
      },
    });
    const dc1 = await tx.deliveryChalan.create({
      data: {
        dcNo: await nextDocNumber(tx, "delivery_chalan", "DC"),
        salesOrderId: so1.id,
        buyerId: buyerMap.get("BUY-001")!.id,
        warehouseId: tejgaon,
        date: d("2026-09-09"),
        driverName: "Kamal Mia",
        vehicleNo: "DHK-MET-11-2233",
        createdById: admin.id,
        items: {
          create: [
            { productId: prodMap.get("BTN-SHL-18-WHT")!.id, quantity: 10000 },
            { productId: prodMap.get("ZIP-NYL-09-BLK")!.id, quantity: 4200 },
          ],
        },
      },
    });
    await postDeliveryChalan(tx, dc1.id);

    const inv1 = await tx.salesInvoice.create({
      data: {
        invNo: await nextDocNumber(tx, "sales_invoice", "INV"),
        salesOrderId: so1.id,
        chalanId: dc1.id,
        buyerId: buyerMap.get("BUY-001")!.id,
        invoiceDate: d("2026-09-09"),
        dueDate: d("2026-10-09"),
        subtotal: 128800,
        taxTotal: 6440,
        total: 135240,
        createdById: admin.id,
        items: {
          create: [
            { productId: prodMap.get("BTN-SHL-18-WHT")!.id, quantity: 10000, rate: 2.8, taxRateId: vatStd.id, taxAmount: 1400, total: 29400 },
            { productId: prodMap.get("ZIP-NYL-09-BLK")!.id, quantity: 4200, rate: 24, taxRateId: vatStd.id, taxAmount: 5040, total: 105840 },
          ],
        },
      },
    });
    await postSalesInvoice(tx, inv1.id);

    const col1 = await tx.paymentCollection.create({
      data: {
        collectionNo: await nextDocNumber(tx, "payment_collection", "RCV"),
        buyerId: buyerMap.get("BUY-001")!.id,
        invoiceId: inv1.id,
        accountId: cityBank.id,
        date: d("2026-09-11"),
        amount: 80000,
        method: "Bank transfer",
        approvalStatus: "APPROVED",
        createdById: admin.id,
      },
    });
    await postCollection(tx, col1.id);

    // Second sale to Metro — invoice only, unpaid.
    const inv2 = await tx.salesInvoice.create({
      data: {
        invNo: await nextDocNumber(tx, "sales_invoice", "INV"),
        buyerId: buyerMap.get("BUY-003")!.id,
        invoiceDate: d("2026-09-11"),
        dueDate: d("2026-10-11"),
        subtotal: 145000,
        taxTotal: 7250,
        total: 152250,
        createdById: admin.id,
        items: {
          create: [
            { productId: prodMap.get("LBL-WVN-40")!.id, quantity: 50000, rate: 2.5, taxRateId: vatStd.id, taxAmount: 6250, total: 131250 },
            { productId: prodMap.get("ELA-WOV-25")!.id, quantity: 1250, rate: 16, taxRateId: vatStd.id, taxAmount: 1000, total: 21000 },
          ],
        },
      },
    });
    await postSalesInvoice(tx, inv2.id);
  });

  // Codes/numbers inserted above bypass nextDocNumber(), so sync the counters
  // to the max suffix already in use — otherwise the API would mint duplicates.
  const { resyncSequences } = await import("./resync-sequences");
  await resyncSequences();

  console.log("Seed complete.");
  console.log("Login: admin@garmenttrade.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
