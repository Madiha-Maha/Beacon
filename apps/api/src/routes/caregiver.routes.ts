import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../index";
import {
  AuthenticatedRequest,
  requireAuth,
} from "../middleware/auth.middleware";
import { HttpError } from "../middleware/error.middleware";
import { schemas } from "@beacon/shared/schemas";

export const caregiverRoutes = Router();

caregiverRoutes.post(
  "/link",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = schemas.CaregiverLinkInputSchema.parse(req.body);
      const userId = req.user!.id;
      const existing = await prisma.caregiverLink.findUnique({
        where: {
          userId_caregiverEmail: {
            userId,
            caregiverEmail: body.caregiverEmail.toLowerCase(),
          },
        },
      });
      if (existing && existing.status !== "revoked") {
        return res.status(200).json({ link: existing });
      }
      const link = await prisma.caregiverLink.create({
        data: {
          userId,
          caregiverEmail: body.caregiverEmail.toLowerCase(),
          status: "pending",
          consentGranted: false,
        },
      });
      return res.status(201).json({ link });
    } catch (err) {
      next(err);
    }
  }
);

caregiverRoutes.post(
  "/link/:linkId/grant",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { linkId } = req.params;
      const link = await prisma.caregiverLink.findUnique({
        where: { id: linkId },
      });
      if (!link || link.userId !== req.user!.id) {
        throw new HttpError(404, "Link not found");
      }
      const updated = await prisma.caregiverLink.update({
        where: { id: linkId },
        data: { status: "active", consentGranted: true, grantedAt: new Date() },
      });
      return res.status(200).json({ link: updated });
    } catch (err) {
      next(err);
    }
  }
);

caregiverRoutes.post(
  "/link/:linkId/revoke",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { linkId } = req.params;
      const link = await prisma.caregiverLink.findUnique({
        where: { id: linkId },
      });
      if (!link || link.userId !== req.user!.id) {
        throw new HttpError(404, "Link not found");
      }
      const updated = await prisma.caregiverLink.update({
        where: { id: linkId },
        data: { status: "revoked", consentGranted: false },
      });
      return res.status(200).json({ link: updated });
    } catch (err) {
      next(err);
    }
  }
);

const TRANSCRIPT_TOKEN_HEADER = "x-beacon-transcript-token";

caregiverRoutes.get(
  "/:linkId/transcript",
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { linkId } = req.params;
      const link = await prisma.caregiverLink.findUnique({
        where: { id: linkId },
      });
      if (!link) {
        throw new HttpError(404, "Link not found");
      }
      if (!link.consentGranted || link.status !== "active") {
        throw new HttpError(403, "Consent not granted for this link");
      }

      const authHeader = req.headers.authorization;
      const token = req.headers[TRANSCRIPT_TOKEN_HEADER] as string | undefined;
      let viewerIsUser = false;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const { signAccessToken } = await import("../middleware/auth.middleware");
          void signAccessToken;
          const jwt = await import("jsonwebtoken");
          const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
          const decoded = jwt.verify(
            authHeader.slice("Bearer ".length),
            JWT_SECRET
          ) as { sub: string };
          viewerIsUser = decoded.sub === link.userId;
        } catch {
          viewerIsUser = false;
        }
      }

      if (!viewerIsUser) {
        const expected = crypto
          .createHash("sha256")
          .update(link.id + link.createdAt.toISOString())
          .digest("hex");
        if (!token || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
          throw new HttpError(403, "Invalid transcript token");
        }
      }

      const logs = await prisma.narrationLog.findMany({
        where: { userId: link.userId },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          tier: true,
          text: true,
          createdAt: true,
          lat: true,
          lng: true,
        },
      });

      return res.status(200).json({
        link: { id: link.id, caregiverEmail: link.caregiverEmail },
        transcriptToken: crypto
          .createHash("sha256")
          .update(link.id + link.createdAt.toISOString())
          .digest("hex"),
        entries: logs.map((l) => ({
          id: l.id,
          tier: l.tier,
          text: l.text,
          at: l.createdAt,
          geolocation:
            l.lat != null && l.lng != null ? { lat: l.lat, lng: l.lng } : null,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

caregiverRoutes.get(
  "/links",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const links = await prisma.caregiverLink.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ links });
  }
);
