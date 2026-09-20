import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/error";
import { requireRole } from "../middleware/auth";
import { runIntegrityChecks } from "../services/integrity";
import { resyncSequences } from "../../prisma/resync-sequences";

export const systemRouter = Router();

// Cross-checks maintained balances (cash, stock, ledgers, invoice paid,
// journal balance) against transaction history. Admin-only.
systemRouter.get(
  "/integrity",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (_req, res) => {
    res.json(await runIntegrityChecks(prisma));
  }),
);

systemRouter.post(
  "/resync-sequences",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    await resyncSequences();
    res.json({ ok: true });
  }),
);
