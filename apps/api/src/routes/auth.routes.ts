import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../index";
import {
  AuthenticatedRequest,
  requireAuth,
  signAccessToken,
} from "../middleware/auth.middleware";
import { HttpError } from "../middleware/error.middleware";
import { schemas } from "@beacon/shared/schemas";

export const authRoutes: Router = Router();

authRoutes.post("/register", async (req, res, next) => {
  try {
    const body = schemas.RegisterSchema.parse(req.body);
    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) {
      throw new HttpError(409, "A user with this email already exists");
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { email: body.email.toLowerCase(), passwordHash },
      select: { id: true, email: true, createdAt: true },
    });
    const accessToken = signAccessToken(user.id, user.email);
    return res.status(201).json({ accessToken, user });
  } catch (err) {
    next(err);
  }
});

authRoutes.post("/login", async (req, res, next) => {
  try {
    const body = schemas.LoginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }
    const passwordOk = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordOk) {
      throw new HttpError(401, "Invalid email or password");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const accessToken = signAccessToken(user.id, user.email);
    return res.status(200).json({
      accessToken,
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    });
  } catch (err) {
    next(err);
  }
});

authRoutes.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, createdAt: true, lastLoginAt: true },
  });
  return res.status(200).json({ user });
});
