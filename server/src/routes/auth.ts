import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { authenticate, signToken } from "../middleware/auth";
import { asyncHandler, badRequest } from "../middleware/error";
import { logAudit } from "../middleware/audit";

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) badRequest("email and password are required");

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!user || user.status !== "ACTIVE") throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    if (!(await bcrypt.compare(String(password), user.passwordHash))) {
      throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const authUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    await logAudit({ action: "LOGIN", module: "Auth", recordId: user.email, req });

    res.json({ token: signToken(authUser), user: authUser });
  }),
);

authRouter.get("/me", authenticate, (req, res) => res.json({ user: req.user }));
