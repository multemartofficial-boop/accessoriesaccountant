import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/error";
import { requireRole } from "../middleware/auth";

export const auditRouter = Router();

auditRouter.get(
  "/",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { module, userId, from, to } = req.query;
    res.json(
      await prisma.auditLog.findMany({
        where: {
          ...(module && module !== "All modules" && { module: String(module) }),
          ...(userId && { userId: Number(userId) }),
          ...((from || to) && {
            createdAt: {
              ...(from && { gte: new Date(String(from)) }),
              ...(to && { lte: new Date(String(to) + "T23:59:59") }),
            },
          }),
        },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    );
  }),
);
