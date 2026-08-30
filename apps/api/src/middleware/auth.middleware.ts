import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../index";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, {
    expiresIn: "7d",
    issuer: "beacon-api",
  });
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function attachUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, email: true },
      });
      if (user) req.user = user;
    } catch {
      // ignore invalid tokens in optional auth
    }
  }
  next();
}
