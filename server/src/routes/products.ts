import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../db";
import { logAudit } from "../middleware/audit";
import { asyncHandler, badRequest, ApiError } from "../middleware/error";
import { requireRole } from "../middleware/auth";

export const productsRouter = Router();
const MODULE = "Products";

// ── Products ──

productsRouter.get(
  "/products",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").toLowerCase();
    const products = await prisma.product.findMany({
      include: {
        category: true,
        unit: true,
        taxRate: true,
        stockBalances: { include: { warehouse: true } },
      },
      orderBy: { name: "asc" },
    });
    const rows = products.map((p) => ({
      ...p,
      totalStock: p.stockBalances.reduce((s, b) => s.plus(b.quantity), new Prisma.Decimal(0)),
    }));
    res.json(q ? rows.filter((p) => `${p.sku} ${p.name} ${p.category.name}`.toLowerCase().includes(q)) : rows);
  }),
);

productsRouter.get(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: { category: true, unit: true, taxRate: true, stockBalances: { include: { warehouse: true } } },
    });
    if (!product) throw new ApiError(404, "Product not found");
    res.json(product);
  }),
);

productsRouter.post(
  "/products",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { sku, name, categoryId, unitId, color, size, purchasePrice, salesPrice, minStock, taxRateId } =
      req.body ?? {};
    if (!sku || !name || !categoryId || !unitId) badRequest("sku, name, categoryId, unitId are required");

    const product = await prisma.product.create({
      data: {
        sku: String(sku).trim(),
        name,
        categoryId: Number(categoryId),
        unitId: Number(unitId),
        color,
        size,
        purchasePrice: purchasePrice ?? 0,
        salesPrice: salesPrice ?? 0,
        minStock: minStock ?? 0,
        taxRateId: taxRateId ? Number(taxRateId) : null,
      },
    });
    await logAudit({ action: "CREATE", module: MODULE, recordId: product.sku, after: product, req });
    res.status(201).json(product);
  }),
);

productsRouter.put(
  "/products/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Product not found");

    const { sku, name, categoryId, unitId, color, size, purchasePrice, salesPrice, minStock, taxRateId, status } =
      req.body ?? {};
    const product = await prisma.product.update({
      where: { id },
      data: {
        sku,
        name,
        color,
        size,
        status,
        ...(categoryId !== undefined && { categoryId: Number(categoryId) }),
        ...(unitId !== undefined && { unitId: Number(unitId) }),
        ...(purchasePrice !== undefined && { purchasePrice }),
        ...(salesPrice !== undefined && { salesPrice }),
        ...(minStock !== undefined && { minStock }),
        ...(taxRateId !== undefined && { taxRateId: taxRateId ? Number(taxRateId) : null }),
      },
    });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: before.sku, before, after: product, req });
    res.json(product);
  }),
);

productsRouter.delete(
  "/products/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Product not found");

    const moves = await prisma.stockMovement.count({ where: { productId: id } });
    if (moves > 0) {
      const product = await prisma.product.update({ where: { id }, data: { status: "INACTIVE" } });
      await logAudit({ action: "UPDATE", module: MODULE, recordId: before.sku, after: { status: "INACTIVE" }, req });
      return res.json({ deactivated: true, product });
    }
    await prisma.product.delete({ where: { id } });
    await logAudit({ action: "DELETE", module: MODULE, recordId: before.sku, before, req });
    res.json({ deleted: true });
  }),
);

// ── Categories ──

productsRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.category.findMany({ include: { taxRate: true, _count: { select: { products: true } } } }),
    );
  }),
);

productsRouter.post(
  "/categories",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { name, code, description, taxRateId } = req.body ?? {};
    if (!name || !code) badRequest("name and code are required");
    const category = await prisma.category.create({
      data: { name, code: String(code).toUpperCase(), description, taxRateId: taxRateId ? Number(taxRateId) : null },
    });
    await logAudit({ action: "CREATE", module: MODULE, recordId: code, after: category, req });
    res.status(201).json(category);
  }),
);

productsRouter.put(
  "/categories/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { name, code, description, taxRateId } = req.body ?? {};
    const before = await prisma.category.findUnique({ where: { id: Number(req.params.id) } });
    const category = await prisma.category.update({
      where: { id: Number(req.params.id) },
      data: { name, code, description, taxRateId: taxRateId ? Number(taxRateId) : null },
    });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: code, before, after: category, req });
    res.json(category);
  }),
);

// ── Units ──

productsRouter.get(
  "/units",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.unit.findMany({ orderBy: { name: "asc" } }));
  }),
);

productsRouter.post(
  "/units",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { name, code } = req.body ?? {};
    if (!name || !code) badRequest("name and code are required");
    const unit = await prisma.unit.create({ data: { name, code: String(code).toUpperCase() } });
    await logAudit({ action: "CREATE", module: MODULE, recordId: code, after: unit, req });
    res.status(201).json(unit);
  }),
);
