import { Router } from "express";
import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import { asyncHandler } from "../middleware/error";

export const analyticsRouter = Router();
const D0 = () => new Prisma.Decimal(0);

function range(req: { query: Record<string, unknown> }) {
  return {
    from: req.query.from ? new Date(String(req.query.from)) : new Date(0),
    to: req.query.to ? new Date(String(req.query.to)) : new Date(),
  };
}

// CSV export helper — Excel opens CSV natively.
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function maybeCsv(req: { query: Record<string, unknown> }, res: import("express").Response, name: string, rows: Record<string, unknown>[], payload: unknown) {
  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
    return res.send(toCsv(rows));
  }
  res.json(payload);
}

// Salesperson-wise: group by order creator.
analyticsRouter.get(
  "/sales-by-user",
  asyncHandler(async (req, res) => {
    const { from, to } = range(req);
    const orders = await prisma.salesInvoice.findMany({
      where: { invoiceDate: { gte: from, lte: to } },
      include: { buyer: true },
    });
    const users = await prisma.user.findMany();
    const grouped = new Map<string, { count: number; total: Prisma.Decimal }>();
    for (const inv of orders) {
      const name = users.find((u) => u.id === inv.createdById)?.name ?? "System";
      const g = grouped.get(name) ?? { count: 0, total: D0() };
      g.count += 1;
      g.total = g.total.plus(inv.total);
      grouped.set(name, g);
    }
    const rows = [...grouped.entries()].map(([user, g]) => ({ user, invoices: g.count, total: g.total }));
    maybeCsv(req, res, "sales-by-user", rows, rows);
  }),
);

analyticsRouter.get(
  "/sales-by-buyer",
  asyncHandler(async (req, res) => {
    const { from, to } = range(req);
    const grouped = await prisma.salesInvoice.groupBy({
      by: ["buyerId"],
      where: { invoiceDate: { gte: from, lte: to } },
      _sum: { total: true, taxTotal: true },
      _count: true,
    });
    const buyers = await prisma.buyer.findMany({ where: { id: { in: grouped.map((g) => g.buyerId) } } });
    const rows = grouped.map((g) => ({
      buyer: buyers.find((b) => b.id === g.buyerId)?.name ?? `#${g.buyerId}`,
      invoices: g._count,
      vat: g._sum.taxTotal,
      total: g._sum.total,
    }));
    maybeCsv(req, res, "sales-by-buyer", rows, rows);
  }),
);

// Fast/slow/dead stock: movement volume per product in range.
analyticsRouter.get(
  "/stock-movement",
  asyncHandler(async (req, res) => {
    const { from, to } = range(req);
    const products = await prisma.product.findMany({
      include: { unit: true, stockBalances: true },
    });
    const moves = await prisma.stockMovement.groupBy({
      by: ["productId"],
      where: { type: { in: ["OUT", "TRANSFER_OUT"] }, createdAt: { gte: from, lte: to } },
      _sum: { quantity: true },
    });
    const moveMap = new Map(moves.map((m) => [m.productId, m._sum.quantity?.abs() ?? D0()]));
    const rows = products.map((p) => {
      const stock = p.stockBalances.reduce((s, b) => s.plus(b.quantity), D0());
      const moved = moveMap.get(p.id) ?? D0();
      return {
        sku: p.sku,
        product: p.name,
        stock,
        movedInPeriod: moved,
        velocity: moved.eq(0) ? "DEAD" : moved.gt(stock.plus(moved).div(4)) ? "FAST" : "SLOW",
      };
    });
    maybeCsv(req, res, "stock-movement", rows, rows);
  }),
);

analyticsRouter.get(
  "/inventory-valuation",
  asyncHandler(async (req, res) => {
    const balances = await prisma.stockBalance.findMany({
      include: { product: { include: { unit: true, category: true } }, warehouse: true },
    });
    const rows = balances.map((b) => ({
      sku: b.product.sku,
      product: b.product.name,
      warehouse: b.warehouse.name,
      quantity: b.quantity,
      cost: b.product.purchasePrice,
      value: b.quantity.mul(b.product.purchasePrice),
    }));
    const total = rows.reduce((s, r) => s.plus(r.value as Prisma.Decimal), D0());
    maybeCsv(req, res, "inventory-valuation", rows, { rows, total });
  }),
);

analyticsRouter.get(
  "/purchase-by-supplier",
  asyncHandler(async (req, res) => {
    const { from, to } = range(req);
    const grouped = await prisma.purchaseInvoice.groupBy({
      by: ["supplierId"],
      where: { invoiceDate: { gte: from, lte: to } },
      _sum: { total: true },
      _count: true,
    });
    const suppliers = await prisma.supplier.findMany({ where: { id: { in: grouped.map((g) => g.supplierId) } } });
    const rows = grouped.map((g) => ({
      supplier: suppliers.find((s) => s.id === g.supplierId)?.name ?? `#${g.supplierId}`,
      invoices: g._count,
      total: g._sum.total,
    }));
    maybeCsv(req, res, "purchase-by-supplier", rows, rows);
  }),
);

// Product profitability: (sales rate - purchase price) × qty sold.
analyticsRouter.get(
  "/product-profitability",
  asyncHandler(async (req, res) => {
    const { from, to } = range(req);
    const items = await prisma.salesInvoiceItem.findMany({
      where: { invoice: { invoiceDate: { gte: from, lte: to } } },
      include: { product: true },
    });
    const grouped = new Map<number, { name: string; sku: string; qty: Prisma.Decimal; revenue: Prisma.Decimal; cost: Prisma.Decimal }>();
    for (const i of items) {
      const g = grouped.get(i.productId) ?? {
        name: i.product.name,
        sku: i.product.sku,
        qty: D0(),
        revenue: D0(),
        cost: D0(),
      };
      g.qty = g.qty.plus(i.quantity);
      g.revenue = g.revenue.plus(i.total);
      g.cost = g.cost.plus(i.product.purchasePrice.mul(i.quantity));
      grouped.set(i.productId, g);
    }
    const rows = [...grouped.values()].map((g) => ({
      ...g,
      profit: g.revenue.minus(g.cost),
      marginPct: g.revenue.gt(0) ? g.revenue.minus(g.cost).div(g.revenue).mul(100) : D0(),
    }));
    maybeCsv(req, res, "product-profitability", rows, rows);
  }),
);

// Warehouse movement summary.
analyticsRouter.get(
  "/warehouse-movement",
  asyncHandler(async (req, res) => {
    const { from, to } = range(req);
    const moves = await prisma.stockMovement.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { warehouse: true },
    });
    const grouped = new Map<string, { inQty: Prisma.Decimal; outQty: Prisma.Decimal; count: number }>();
    for (const m of moves) {
      const g = grouped.get(m.warehouse.name) ?? { inQty: D0(), outQty: D0(), count: 0 };
      if (m.quantity.gt(0)) g.inQty = g.inQty.plus(m.quantity);
      else g.outQty = g.outQty.plus(m.quantity.abs());
      g.count += 1;
      grouped.set(m.warehouse.name, g);
    }
    const rows = [...grouped.entries()].map(([warehouse, g]) => ({ warehouse, ...g }));
    maybeCsv(req, res, "warehouse-movement", rows, rows);
  }),
);
