import { Router } from "express";
import { prisma } from "../index";
import {
  AuthenticatedRequest,
  attachUser,
} from "../middleware/auth.middleware";
import { schemas } from "@beacon/shared/schemas";
import { HazardReportRecord } from "@beacon/shared/types";

export const hazardsRoutes = Router();

const DEFAULT_EXPIRY_HOURS = 72;

function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

hazardsRoutes.post("/", attachUser, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = schemas.HazardReportInputSchema.parse(req.body);
    const record = await prisma.hazardReport.create({
      data: {
        lat: body.lat,
        lng: body.lng,
        type: body.type,
        severity: body.severity,
        notes: body.notes ?? null,
        expiresAt: new Date(Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000),
        reporterId: req.user?.id ?? null,
      },
    });
    return res.status(201).json({ report: record });
  } catch (err) {
    next(err);
  }
});

hazardsRoutes.get("/", async (req, res, next) => {
  try {
    const query = schemas.NearbyHazardsQuerySchema.parse(req.query);
    const latRange = query.radiusKm / 111;
    const lngRange =
      query.radiusKm / (111 * Math.cos((query.lat * Math.PI) / 180));
    const now = new Date();

    const candidates = await prisma.hazardReport.findMany({
      where: {
        lat: { gte: query.lat - latRange, lte: query.lat + latRange },
        lng: { gte: query.lng - lngRange, lte: query.lng + lngRange },
        expiresAt: { gt: now },
      },
      orderBy: { reportedAt: "desc" },
      take: 200,
    });

    const filtered: HazardReportRecord[] = candidates
      .map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        type: r.type as HazardReportRecord["type"],
        severity: r.severity as HazardReportRecord["severity"],
        notes: r.notes ?? undefined,
        reportedAt: r.reportedAt,
        expiresAt: r.expiresAt,
        reporterId: r.reporterId,
        distanceKm: haversineDistanceKm(query.lat, query.lng, r.lat, r.lng),
      }))
      .filter((r: any) => r.distanceKm <= query.radiusKm)
      .sort(
        (a: any, b: any) => (a.distanceKm as number) - (b.distanceKm as number)
      ) as any;

    return res.status(200).json({
      count: filtered.length,
      radiusKm: query.radiusKm,
      hazards: filtered,
    });
  } catch (err) {
    next(err);
  }
});
