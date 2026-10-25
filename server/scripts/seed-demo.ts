// Demo seed: top-up stock for products that went below their minimum and add
// missing sample records (sales returns). Everything is posted through the
// same services the API uses, so stock/ledger/journal stay consistent.
// Run with: npx tsx scripts/seed-demo.ts
import { prisma, withTx } from "../src/db";
import { Prisma } from "../src/generated/prisma/client";
import { postPurchaseInvoice, postSalesReturn, postStockAdjustment } from "../src/services/posting";
import { nextDocNumber } from "../src/services/numbering";

const d = (s: string) => new Date(s);
const MARKER = "DEMO-STOCK-FIX";

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const tejgaon = await prisma.warehouse.findFirstOrThrow({
    where: { status: "ACTIVE" },
    orderBy: { id: "asc" },
  });
  const vatStd = await prisma.taxRate.findUnique({ where: { code: "VAT-STD" } });
  const productBySku = async (sku: string) =>
    prisma.product.findUniqueOrThrow({ where: { sku } });

  const alreadyDone = await prisma.stockAdjustment.count({ where: { reference: MARKER } });
  if (alreadyDone === 0) {
    // ── Purchase invoices (real stock-in + payable) for products below min ──
    const purchases: {
      supplier: string;
      date: string;
      lines: { sku: string; qty: number; rate: number }[];
    }[] = [
      {
        supplier: "SUP-018",
        date: "2026-10-05",
        lines: [{ sku: "BTN-PLS-24-NVY", qty: 60000, rate: 1.5 }],
      },
      {
        supplier: "SUP-011",
        date: "2026-10-07",
        lines: [
          { sku: "ZIP-NYL-09-BLK", qty: 6000, rate: 18 },
          { sku: "ZIP-MTL-07-BRS", qty: 4000, rate: 32 },
        ],
      },
      {
        supplier: "SUP-024",
        date: "2026-10-08",
        lines: [
          { sku: "ELA-WOV-25", qty: 10000, rate: 12 },
          { sku: "TAP-TWL-15", qty: 32000, rate: 8 },
        ],
      },
    ];

    for (const p of purchases) {
      const sup = await prisma.supplier.findUniqueOrThrow({ where: { code: p.supplier } });
      await withTx(async (tx) => {
        const invNo = await nextDocNumber(tx, "purchase_invoice", "PI");
        let subtotal = new Prisma.Decimal(0);
        let taxTotal = new Prisma.Decimal(0);
        const items = [] as Prisma.PurchaseInvoiceItemCreateManyInvoiceInput[];
        for (const l of p.lines) {
          const prod = await productBySku(l.sku);
          const net = new Prisma.Decimal(l.qty).mul(l.rate);
          const tax = vatStd ? net.mul(vatStd.ratePercent).div(100) : new Prisma.Decimal(0);
          subtotal = subtotal.plus(net);
          taxTotal = taxTotal.plus(tax);
          items.push({
            productId: prod.id,
            quantity: l.qty,
            rate: l.rate,
            taxRateId: vatStd?.id ?? null,
            taxAmount: tax,
            total: net.plus(tax),
          });
        }
        const created = await tx.purchaseInvoice.create({
          data: {
            invNo,
            supplierId: sup.id,
            warehouseId: tejgaon.id,
            invoiceDate: d(p.date),
            notes: "Replenishment to bring stock above minimum",
            subtotal,
            taxTotal,
            total: subtotal.plus(taxTotal),
            createdById: admin.id,
            items: { create: items },
          },
        });
        await postPurchaseInvoice(tx, created.id);
        console.log(`PI ${invNo} posted for ${p.supplier}`);
      });
    }

    // ── Stock adjustments for the two anomalous balances ──
    // LBL-CR-15 was over-delivered on chalans (deep negative) and "kkk" is a
    // test SKU with a very high minimum — corrections via adjustment keep the
    // payables ledger realistic instead of faking giant purchases.
    const adjustments = [
      { sku: "LBL-CR-15", qty: 55000, cost: 240, reason: "Stock recount correction" },
      { sku: "kkk", qty: 120000, cost: 12, reason: "Opening stock" },
    ];
    for (const a of adjustments) {
      const prod = await productBySku(a.sku);
      await withTx(async (tx) => {
        const adjNo = await nextDocNumber(tx, "stock_adjustment", "ADJ");
        const created = await tx.stockAdjustment.create({
          data: {
            adjNo,
            productId: prod.id,
            warehouseId: tejgaon.id,
            quantity: a.qty,
            unitCost: a.cost,
            reason: a.reason,
            reference: MARKER,
            approvalStatus: "APPROVED",
            createdById: admin.id,
          },
        });
        await postStockAdjustment(tx, created.id);
        console.log(`ADJ ${adjNo} posted for ${a.sku}`);
      });
    }
  } else {
    console.log("Stock top-up already applied — skipping.");
  }

  // ── Sales returns (none existed yet) ──
  const returnCount = await prisma.salesReturn.count();
  if (returnCount === 0) {
    const invoices = await prisma.salesInvoice.findMany({
      include: { items: true },
      orderBy: { invoiceDate: "desc" },
      take: 10,
    });
    const picks = invoices.filter((i) => i.items.length > 0).slice(0, 2);
    for (const inv of picks) {
      const item = inv.items[0]!;
      const qty = Math.max(1, Math.min(200, Math.floor(Number(item.quantity) * 0.05)));
      await withTx(async (tx) => {
        const returnNo = await nextDocNumber(tx, "sales_return", "SR");
        const lineTotal = new Prisma.Decimal(qty).mul(item.rate);
        const created = await tx.salesReturn.create({
          data: {
            returnNo,
            invoiceId: inv.id,
            buyerId: inv.buyerId,
            warehouseId: tejgaon.id,
            date: d("2026-10-15"),
            reason: "Damaged goods returned by buyer",
            total: lineTotal,
            createdById: admin.id,
            items: {
              create: [
                { productId: item.productId, quantity: qty, rate: item.rate, total: lineTotal },
              ],
            },
          },
        });
        await postSalesReturn(tx, created.id);
        console.log(`Sales return ${returnNo} posted against ${inv.invNo}`);
      });
    }
  } else {
    console.log("Sales returns already present — skipping.");
  }

  console.log("Done.");
}

main().finally(() => prisma.$disconnect());
