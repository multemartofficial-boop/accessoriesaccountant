import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { logAudit } from "../middleware/audit";
import { asyncHandler, badRequest, ApiError } from "../middleware/error";
import { requireRole } from "../middleware/auth";

export const settingsRouter = Router();
const MODULE = "Settings";

// ── Company profile (singleton) ──

settingsRouter.get(
  "/company",
  asyncHandler(async (_req, res) => {
    res.json((await prisma.companyProfile.findUnique({ where: { id: 1 } })) ?? {});
  }),
);

settingsRouter.put(
  "/company",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { name, legalName, logoUrl, address, phone, email, website, vatRegNo, tradeLicenseNo } = req.body ?? {};
    const before = await prisma.companyProfile.findUnique({ where: { id: 1 } });
    const profile = await prisma.companyProfile.upsert({
      where: { id: 1 },
      create: { id: 1, name: name ?? "GarmentTrade" },
      update: { name, legalName, logoUrl, address, phone, email, website, vatRegNo, tradeLicenseNo },
    });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: "company", before, after: profile, req });
    res.json(profile);
  }),
);

// ── Key-value settings ──

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.setting.findMany();
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  }),
);

settingsRouter.put(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const entries = Object.entries(req.body ?? {}) as [string, string][];
    for (const [key, value] of entries) {
      await prisma.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
    }
    await logAudit({ action: "UPDATE", module: MODULE, recordId: "settings", after: req.body, req });
    res.json(Object.fromEntries(entries));
  }),
);

// ── Document sequences ──

settingsRouter.get(
  "/sequences",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    res.json(await prisma.documentSequence.findMany());
  }),
);

settingsRouter.put(
  "/sequences/:docType",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { prefix, padding, yearInfix } = req.body ?? {};
    const docType = String(req.params.docType);
    const seq = await prisma.documentSequence.update({
      where: { docType },
      data: { prefix, padding: padding !== undefined ? Number(padding) : undefined, yearInfix },
    });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: docType, after: seq, req });
    res.json(seq);
  }),
);

// ── Users ──

settingsRouter.get(
  "/users",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
    res.json(users.map(({ passwordHash: _, ...u }) => u));
  }),
);

settingsRouter.post(
  "/users",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { name, email, password, role, location } = req.body ?? {};
    if (!name || !email || !password) badRequest("name, email and password are required");
    const user = await prisma.user.create({
      data: {
        name,
        email: String(email).toLowerCase(),
        passwordHash: await bcrypt.hash(String(password), 10),
        role: role ?? "STAFF",
        location,
      },
    });
    await logAudit({ action: "CREATE", module: MODULE, recordId: email, after: { ...user, passwordHash: undefined }, req });
    const { passwordHash: _, ...safe } = user;
    res.status(201).json(safe);
  }),
);

settingsRouter.put(
  "/users/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "User not found");
    const { name, email, role, location, status, password } = req.body ?? {};
    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        role,
        location,
        status,
        ...(email && { email: String(email).toLowerCase() }),
        ...(password && { passwordHash: await bcrypt.hash(String(password), 10) }),
      },
    });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: before.email, after: { ...user, passwordHash: undefined }, req });
    const { passwordHash: _, ...safe } = user;
    res.json(safe);
  }),
);

settingsRouter.delete(
  "/users/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (req.user?.id === id) badRequest("You cannot delete your own account");
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "User not found");
    const user = await prisma.user.update({ where: { id }, data: { status: "INACTIVE" } });
    await logAudit({ action: "UPDATE", module: MODULE, recordId: before.email, after: { status: "INACTIVE" }, req });
    const { passwordHash: _, ...safe } = user;
    res.json(safe);
  }),
);
