import { Router } from "express";
import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import { logAudit } from "../middleware/audit";
import { asyncHandler, badRequest } from "../middleware/error";
import { requireRole } from "../middleware/auth";

export const vatRouter = Router();
const MODULE = "VAT & Tax";

vatRouter.get(
  "/rates",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.taxRate.findMany({ orderBy: { id: "asc" } }));
  }),
);

vatRouter.post(
  "/rates",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { name, code, ratePercent, type, effectiveFrom } = req.body ?? {};
    if (!name || !code || ratePercent === undefined) badRequest("name, code and ratePercent are required");
    const rate = await prisma.taxRate.create({
      data: {
        name,
        code: String(code).toUpperCase(),
        ratePercent,
        type: type ?? "BOTH",
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      },
    });
    await logAudit({ action: "CREATE", module: MODULE, recordId: code, after: rate, req });
    res.status(201).json(rate);
  }),
);

vatRouter.put(
  "/rates/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.taxRate.findUnique({ where: { id } });
    const { name, ratePercent, type, effectiveFrom, status } = req.body ?? {};
    const rate = await prisma.taxRate.update({
      where: { id },
      data: {
        name,
        type,
        status,
        ...(ratePercent !== undefined && { ratePercent }),
        ...(effectiveFrom !== undefined && { effectiveFrom: new Date(effectiveFrom) }),
      },
    });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: before?.code, before, after: rate, req });
    res.json(rate);
  }),
);

// VAT report grouped by month: taxable sales / output VAT vs
// taxable purchase / input VAT → net payable.
vatRouter.get(
  "/report",
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), 0, 1);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();

    const [sales, purchases] = await Promise.all([
      prisma.salesInvoice.findMany({
        where: { invoiceDate: { gte: from, lte: to }, status: { not: "CANCELLED" } },
        select: { invoiceDate: true, subtotal: true, discount: true, taxTotal: true },
      }),
      prisma.purchaseInvoice.findMany({
        where: { invoiceDate: { gte: from, lte: to }, status: { not: "CANCELLED" } },
        select: { invoiceDate: true, subtotal: true, taxTotal: true },
      }),
    ]);

    const bucket = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const periods = new Map<string, { taxableSales: Prisma.Decimal; outputVat: Prisma.Decimal; taxablePurchase: Prisma.Decimal; inputVat: Prisma.Decimal }>();
    const entry = (key: string) => {
      if (!periods.has(key)) {
        periods.set(key, {
          taxableSales: new Prisma.Decimal(0),
          outputVat: new Prisma.Decimal(0),
          taxablePurchase: new Prisma.Decimal(0),
          inputVat: new Prisma.Decimal(0),
        });
      }
      return periods.get(key)!;
    };
    for (const s of sales) {
      const e = entry(bucket(s.invoiceDate));
      e.taxableSales = e.taxableSales.plus(s.subtotal).minus(s.discount);
      e.outputVat = e.outputVat.plus(s.taxTotal);
    }
    for (const p of purchases) {
      const e = entry(bucket(p.invoiceDate));
      e.taxablePurchase = e.taxablePurchase.plus(p.subtotal);
      e.inputVat = e.inputVat.plus(p.taxTotal);
    }

    res.json(
      [...periods.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, v]) => ({ period, ...v, netPayable: v.outputVat.minus(v.inputVat) })),
    );
  }),
);
