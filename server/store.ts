/**
 * Beacon — Real-Time AI Sight Companion
 * In-Memory & File Store for Users, Hazards, Caregiver Links, and Narration Logs
 */

import { CaregiverLink, HazardReport, NarrationLogEntry } from "../src/types.ts";

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "user" | "caregiver";
  createdAt: string;
}

// Initial realistic seed hazards across common locations (and relative offsets for demo)
export const initialHazards: HazardReport[] = [
  {
    id: "hz-101",
    lat: 37.7749,
    lng: -122.4194,
    type: "curb",
    title: "Steep Unmarked Curb",
    description: "Curb with missing tactile paving; steep drop-off onto 5th St crosswalk.",
    severity: "warning",
    reportedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    reportedBy: "community-patrol",
    verifiedCount: 7,
  },
  {
    id: "hz-102",
    lat: 37.7753,
    lng: -122.4188,
    type: "broken_pavement",
    title: "Buckled Sidewalk Slab",
    description: "Tree root heave creating a 3-inch tripping ridge across pedestrian walkway.",
    severity: "critical",
    reportedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 14).toISOString(),
    reportedBy: "beacon-user-28",
    verifiedCount: 14,
  },
  {
    id: "hz-103",
    lat: 37.7742,
    lng: -122.4201,
    type: "construction",
    title: "Temporary Scaffolding Barrier",
    description: "Construction fencing narrowing sidewalk to 3 feet; overhead support pipes low.",
    severity: "critical",
    reportedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
    reportedBy: "beacon-transit-bot",
    verifiedCount: 19,
  },
  {
    id: "hz-104",
    lat: 37.7738,
    lng: -122.4179,
    type: "blocked_ramp",
    title: "Wheelchair Ramp Blocked",
    description: "Commercial delivery crates deposited in front of ADA curb ramp entrance.",
    severity: "warning",
    reportedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 1).toISOString(),
    reportedBy: "beacon-user-12",
    verifiedCount: 5,
  },
  {
    id: "hz-105",
    lat: 37.7761,
    lng: -122.4215,
    type: "wet_floor",
    title: "Polished Granite Slippery When Wet",
    description: "Metro plaza entryway granite extremely slick due to ongoing misting/rain.",
    severity: "warning",
    reportedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    reportedBy: "safety-officer",
    verifiedCount: 9,
  },
];

class AppDataStore {
  private hazards: HazardReport[] = [...initialHazards];
  private users: UserAccount[] = [
    {
      id: "usr-demo",
      email: "demo@beacon.vision",
      name: "Alex Rivera",
      passwordHash: "demo1234",
      role: "user",
      createdAt: new Date().toISOString(),
    },
  ];
  private caregiverLinks: CaregiverLink[] = [
    {
      id: "cg-link-1",
      userId: "usr-demo",
      caregiverEmail: "sarah.rivera@family.org",
      consentGranted: true,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      lastActiveAt: new Date().toISOString(),
      token: "mirror-token-9982",
    },
  ];
  private narrationLogs: NarrationLogEntry[] = [
    {
      id: "log-1",
      timestamp: new Date(Date.now() - 120000).toISOString(),
      tier: "hazard",
      text: "Caution: steps detected ahead. Watch your footing.",
      hapticPattern: "hazard-near",
      lat: 37.7749,
      lng: -122.4194,
    },
    {
      id: "log-2",
      timestamp: new Date(Date.now() - 60000).toISOString(),
      tier: "social",
      text: "A pedestrian is walking toward you on your path.",
      hapticPattern: "social-cue",
      lat: 37.7751,
      lng: -122.4192,
    },
    {
      id: "log-3",
      timestamp: new Date(Date.now() - 15000).toISOString(),
      tier: "ambient",
      text: "Entering sunlit plaza. Smooth paving stones underfoot.",
      lat: 37.7753,
      lng: -122.4190,
    },
  ];

  // Hazard Mesh Operations
  public getHazards(lat?: number, lng?: number, radiusKm: number = 25): HazardReport[] {
    if (lat === undefined || lng === undefined) {
      return this.hazards;
    }

    // Filter by Haversine distance
    return this.hazards
      .map((h) => {
        const dist = this.haversineDistance(lat, lng, h.lat, h.lng);
        return { ...h, distanceMeters: Math.round(dist * 1000) };
      })
      .filter((h) => (h.distanceMeters ?? 0) <= radiusKm * 1000)
      .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  }

  public addHazard(report: Omit<HazardReport, "id" | "reportedAt" | "expiresAt" | "verifiedCount">): HazardReport {
    const newHazard: HazardReport = {
      ...report,
      id: `hz-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      reportedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000 * 14).toISOString(), // 14-day expiry
      verifiedCount: 1,
    };
    this.hazards.unshift(newHazard);
    return newHazard;
  }

  public verifyHazard(id: string): HazardReport | null {
    const hazard = this.hazards.find((h) => h.id === id);
    if (hazard) {
      hazard.verifiedCount += 1;
      return hazard;
    }
    return null;
  }

  // Caregiver Links
  public getCaregiverLinks(userId: string): CaregiverLink[] {
    return this.caregiverLinks.filter((l) => l.userId === userId);
  }

  public getCaregiverLinkById(id: string): CaregiverLink | undefined {
    return this.caregiverLinks.find((l) => l.id === id || l.token === id);
  }

  public createCaregiverLink(userId: string, email: string): CaregiverLink {
    const existing = this.caregiverLinks.find((l) => l.userId === userId && l.caregiverEmail === email);
    if (existing) return existing;

    const link: CaregiverLink = {
      id: `cg-${Date.now()}`,
      userId,
      caregiverEmail: email,
      consentGranted: true, // User grants consent upon initiating
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      token: `beacon-mirror-${Math.random().toString(36).substring(2, 9)}`,
    };
    this.caregiverLinks.push(link);
    return link;
  }

  // Narration Logs
  public addNarrationLog(entry: Omit<NarrationLogEntry, "id" | "timestamp">): NarrationLogEntry {
    const newEntry: NarrationLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.narrationLogs.unshift(newEntry);
    if (this.narrationLogs.length > 100) {
      this.narrationLogs.pop();
    }
    return newEntry;
  }

  public getNarrationLogs(limit: number = 30): NarrationLogEntry[] {
    return this.narrationLogs.slice(0, limit);
  }

  // Helper: Haversine distance in kilometers
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const appStore = new AppDataStore();
