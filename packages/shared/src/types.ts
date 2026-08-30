export type NarrationTier = "hazard" | "social" | "ambient";

export type HapticPattern = "hazard-near" | "hazard-approaching" | "social-cue";

export interface TriageOutput {
  tier: NarrationTier;
  text: string;
  hapticPattern?: HapticPattern;
}

export interface TriageInput {
  detectedObjects: string[];
  proximityHints?: string;
  sceneDescription: string;
}

export type HazardType =
  | "stairs"
  | "curb"
  | "vehicle"
  | "obstacle"
  | "wet_floor"
  | "hole"
  | "drop_off"
  | "construction"
  | "blocked_ramp"
  | "broken_pavement"
  | "other";

export type HazardSeverity = "low" | "medium" | "high" | "critical";

export interface HazardReportInput {
  lat: number;
  lng: number;
  type: HazardType;
  severity: HazardSeverity;
  notes?: string;
}

export interface HazardReportRecord extends HazardReportInput {
  id: string;
  reportedAt: Date;
  expiresAt: Date;
  reporterId: string | null;
}

export interface NearbyHazardsQuery {
  lat: number;
  lng: number;
  radiusKm: number;
}

export type CaregiverLinkStatus = "pending" | "active" | "revoked";

export interface CaregiverLinkInput {
  caregiverEmail: string;
}

export interface CaregiverLinkRecord extends CaregiverLinkInput {
  id: string;
  userId: string;
  status: CaregiverLinkStatus;
  consentGranted: boolean;
  createdAt: Date;
  grantedAt: Date | null;
}

export interface NarrationLogEntry {
  id: string;
  userId: string;
  tier: NarrationTier;
  text: string;
  createdAt: Date;
  geolocation: { lat: number; lng: number } | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserRecord {
  id: string;
  email: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface SocketFramePayload {
  frame: string;
  geolocation?: { lat: number; lng: number };
}

export type VisionProviderName = "openai" | "anthropic" | "mock";

export interface VisionAnalysis {
  detectedObjects: string[];
  proximityHints?: string;
  sceneDescription: string;
  rawResponse?: unknown;
}
