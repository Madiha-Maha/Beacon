/**
 * Beacon — Real-Time AI Sight Companion
 * Shared Domain Types and Contracts
 */

export type NarrationTier = "hazard" | "social" | "ambient";

export type HapticPattern = "hazard-near" | "hazard-approaching" | "social-cue";

export interface TriageInput {
  detectedObjects: string[];
  proximityHints?: string;
  sceneDescription: string;
  confidenceScore?: number;
  motionDetected?: boolean;
}

export interface TriageOutput {
  id: string;
  tier: NarrationTier;
  text: string;
  hapticPattern?: HapticPattern;
  timestamp: number;
  detectedObjects: string[];
  confidence: number;
  location?: {
    lat: number;
    lng: number;
  };
}

export type HazardType =
  | "stairs_down"
  | "stairs_up"
  | "curb"
  | "vehicle"
  | "construction"
  | "broken_pavement"
  | "wet_floor"
  | "blocked_ramp"
  | "low_overhang"
  | "general_obstacle";

export type HazardSeverity = "critical" | "warning" | "advisory";

export interface HazardReport {
  id: string;
  lat: number;
  lng: number;
  type: HazardType;
  title: string;
  description: string;
  severity: HazardSeverity;
  reportedAt: string;
  expiresAt: string;
  reportedBy?: string;
  verifiedCount: number;
  distanceMeters?: number;
}

export interface CaregiverLink {
  id: string;
  userId: string;
  caregiverEmail: string;
  consentGranted: boolean;
  createdAt: string;
  lastActiveAt?: string;
  token: string;
}

export interface NarrationLogEntry {
  id: string;
  timestamp: string;
  tier: NarrationTier;
  text: string;
  hapticPattern?: HapticPattern;
  lat?: number;
  lng?: number;
}

export interface UserSettings {
  highContrast: boolean;
  voiceSpeed: number;
  voicePitch: number;
  hapticsEnabled: boolean;
  speechEnabled: boolean;
  priorityFilter: "all" | "hazards_only" | "hazards_and_social";
  samplingIntervalMs: number; // 1000 - 3000ms
  offlineDegradedMode: boolean;
  audioVolume: number;
}

export interface SystemHealthStatus {
  status: "ok" | "degraded" | "error";
  visionProvider: string;
  activeSockets: number;
  dbStatus: "connected" | "simulated" | "ready";
  uptimeSeconds: number;
  timestamp: string;
}
