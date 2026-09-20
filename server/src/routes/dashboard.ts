import { Router } from "express";
import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import { asyncHandler } from "../middleware/error";
import { lowStockProducts } from "../services/stock";

export const dashboardRouter = Router();
const D0 = () => new Prisma.Decimal(0);

dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const period = String(req.query.period ?? "month"); // day | month | year
    const now = new Date();
    const start =
      period === "day"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : period === "year"
          ? new Date(now.getFullYear(), 0, 1)
          : new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      salesAgg,
      purchaseAgg,
      receivableAgg,
      payableAgg,
      cashAgg,
      balances,
      lowStock,
      overdueAgg,
      topBuyersRaw,
      topProductsRaw,
      salesInvoices,
      purchaseInvoices,
    ] = await Promise.all([
      prisma.salesInvoice.aggregate({ where: { invoiceDate: { gte: start } }, _sum: { total: true } }),
      prisma.purchaseInvoice.aggregate({ where: { invoiceDate: { gte: start } }, _sum: { total: true } }),
      prisma.buyer.aggregate({ _sum: { outstanding: true } }),
      prisma.supplier.aggregate({ _sum: { payable: true } }),
      prisma.cashAccount.aggregate({ _sum: { balance: true } }),
      prisma.stockBalance.findMany({ include: { product: true } }),
      lowStockProducts(prisma),
      prisma.salesInvoice.aggregate({
        where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: now } },
        _sum: { total: true },
      }),
      prisma.salesInvoice.groupBy({
        by: ["buyerId"],
        _sum: { total: true },
        _count: true,
        orderBy: { _sum: { total: "desc" } },
        take: 5,
      }),
      prisma.salesInvoiceItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.salesInvoice.findMany({ where: { invoiceDate: { gte: new Date(now.getFullYear(), 0, 1) } }, select: { invoiceDate: true, total: true } }),
      prisma.purchaseInvoice.findMany({ where: { invoiceDate: { gte: new Date(now.getFullYear(), 0, 1) } }, select: { invoiceDate: true, total: true } }),
    ]);

    const stockValue = balances.reduce((s, b) => s.plus(b.quantity.mul(b.product.purchasePrice)), D0());
    const salesTotal = salesAgg._sum.total ?? D0();
    const cogsApprox = balances.reduce((s, b) => s, D0()); // gross margin computed from invoices below
    void cogsApprox;

    // Gross margin: (sales subtotal - cogs) / sales subtotal using posted COGS journal (5100).
    const cogsLines = await prisma.journalLine.aggregate({
      where: { account: { code: "5100" }, entry: { date: { gte: start } } },
      _sum: { debit: true },
    });
    const grossMargin = salesTotal.gt(0)
      ? salesTotal.minus(cogsLines._sum.debit ?? 0).div(salesTotal).mul(100)
      : D0();

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chart = monthNames.map((month, i) => ({
      month,
      sales: salesInvoices
        .filter((v) => v.invoiceDate.getMonth() === i)
        .reduce((s, v) => s.plus(v.total), D0()),
      purchase: purchaseInvoices
        .filter((v) => v.invoiceDate.getMonth() === i)
        .reduce((s, v) => s.plus(v.total), D0()),
    }));

    const buyerIds = topBuyersRaw.map((b) => b.buyerId);
    const productIds = topProductsRaw.map((p) => p.productId);
    const [buyerNames, productNames] = await Promise.all([
      prisma.buyer.findMany({ where: { id: { in: buyerIds } } }),
      prisma.product.findMany({ where: { id: { in: productIds } } }),
    ]);

    res.json({
      period,
      sales: salesTotal,
      purchase: purchaseAgg._sum.total ?? 0,
      receivable: receivableAgg._sum.outstanding ?? 0,
      payable: payableAgg._sum.payable ?? 0,
      cashAndBank: cashAgg._sum.balance ?? 0,
      stockValue,
      grossMarginPct: grossMargin,
      overdueReceivable: overdueAgg._sum.total ?? 0,
      lowStock,
      topBuyers: topBuyersRaw.map((b) => ({
        name: buyerNames.find((n) => n.id === b.buyerId)?.name ?? `#${b.buyerId}`,
        orders: b._count,
        sales: b._sum.total,
      })),
      topProducts: topProductsRaw.map((p) => ({
        sku: productNames.find((n) => n.id === p.productId)?.sku ?? `#${p.productId}`,
        product: productNames.find((n) => n.id === p.productId)?.name ?? "",
        qty: p._sum.quantity,
      })),
      chart,
    });
  }),
);
