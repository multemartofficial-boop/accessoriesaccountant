import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler, ApiError } from "../middleware/error";

export const documentsRouter = Router();

// Document payloads — the frontend renders + prints these via the existing
// preview component (window.print), so PDF lib isn't needed on the server.

documentsRouter.get(
  "/invoice/:id",
  asyncHandler(async (req, res) => {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        buyer: true,
        salesOrder: true,
        chalan: true,
        items: { include: { product: { include: { unit: true } } } },
      },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    const company = await prisma.companyProfile.findUnique({ where: { id: 1 } });
    res.json({ type: "TAX_INVOICE", company, invoice });
  }),
);

documentsRouter.get(
  "/chalan/:id",
  asyncHandler(async (req, res) => {
    const chalan = await prisma.deliveryChalan.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        buyer: true,
        warehouse: true,
        salesOrder: true,
        items: { include: { product: { include: { unit: true } } } },
      },
    });
    if (!chalan) throw new ApiError(404, "Chalan not found");
    const company = await prisma.companyProfile.findUnique({ where: { id: 1 } });
    res.json({ type: "DELIVERY_CHALAN", company, chalan });
  }),
);

documentsRouter.get(
  "/purchase-invoice/:id",
  asyncHandler(async (req, res) => {
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id: Number(req.params.id) },
      include: { supplier: true, warehouse: true, order: true, items: { include: { product: { include: { unit: true } } } } },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    const company = await prisma.companyProfile.findUnique({ where: { id: 1 } });
    res.json({ type: "PURCHASE_INVOICE", company, invoice });
  }),
);

// Lookup lists for the document composer dropdowns.
documentsRouter.get(
  "/sources",
  asyncHandler(async (_req, res) => {
    const [invoices, chalans, orders, buyers] = await Promise.all([
      prisma.salesInvoice.findMany({ select: { id: true, invNo: true }, orderBy: { id: "desc" }, take: 50 }),
      prisma.deliveryChalan.findMany({ select: { id: true, dcNo: true }, orderBy: { id: "desc" }, take: 50 }),
      prisma.salesOrder.findMany({ select: { id: true, soNo: true }, orderBy: { id: "desc" }, take: 50 }),
      prisma.buyer.findMany({ select: { id: true, name: true, code: true } }),
    ]);
    res.json({ invoices, chalans, orders, buyers });
  }),
);
