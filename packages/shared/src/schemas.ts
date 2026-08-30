import { z } from "zod";

export const NarrationTierSchema = z.enum(["hazard", "social", "ambient"]);

export const HapticPatternSchema = z.enum([
  "hazard-near",
  "hazard-approaching",
  "social-cue",
]);

export const TriageOutputSchema = z.object({
  tier: NarrationTierSchema,
  text: z.string().min(1).max(500),
  hapticPattern: HapticPatternSchema.optional(),
});

export const TriageInputSchema = z.object({
  detectedObjects: z.array(z.string()),
  proximityHints: z.string().optional(),
  sceneDescription: z.string(),
});

export const HazardTypeSchema = z.enum([
  "stairs",
  "curb",
  "vehicle",
  "obstacle",
  "wet_floor",
  "hole",
  "drop_off",
  "construction",
  "blocked_ramp",
  "broken_pavement",
  "other",
]);

export const HazardSeveritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const HazardReportInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  type: HazardTypeSchema,
  severity: HazardSeveritySchema,
  notes: z.string().max(500).optional(),
});

export const NearbyHazardsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.01).max(50).default(0.5),
});

export const CaregiverLinkStatusSchema = z.enum([
  "pending",
  "active",
  "revoked",
]);

export const CaregiverLinkInputSchema = z.object({
  caregiverEmail: z.string().email(),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const SocketFramePayloadSchema = z.object({
  frame: z.string().base64(),
  geolocation: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});
