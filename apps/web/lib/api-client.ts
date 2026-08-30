const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function withAuth(headers: HeadersInit = {}): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("beacon-app-state-v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        const token = parsed.state?.accessToken;
        if (token) out["Authorization"] = `Bearer ${token}`;
      }
    } catch {
      // ignore
    }
  }
  for (const [k, v] of Object.entries(headers as Record<string, string>)) {
    out[k] = v;
  }
  return out;
}

async function jsonRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: withAuth({
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    }),
  });
  if (!res.ok) {
    let msg = `Request failed with status ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error) msg = err.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const beaconApi = {
  baseUrl: API_BASE,

  register(payload: { email: string; password: string }) {
    return jsonRequest<{
      accessToken: string;
      user: { id: string; email: string; createdAt: string };
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }) {
    return jsonRequest<{
      accessToken: string;
      user: { id: string; email: string; createdAt: string };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  me() {
    return jsonRequest<{ user: { id: string; email: string; createdAt: string; lastLoginAt: string | null } }>(
      "/auth/me"
    );
  },

  reportHazard(payload: {
    lat: number;
    lng: number;
    type: string;
    severity: string;
    notes?: string;
  }) {
    return jsonRequest<{ report: unknown }>("/hazards", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  nearbyHazards(query: { lat: number; lng: number; radiusKm?: number }) {
    const q = new URLSearchParams({
      lat: String(query.lat),
      lng: String(query.lng),
    });
    if (query.radiusKm != null) q.set("radiusKm", String(query.radiusKm));
    return jsonRequest<{
      count: number;
      radiusKm: number;
      hazards: Array<{
        id: string;
        lat: number;
        lng: number;
        type: string;
        severity: string;
        notes?: string;
        reportedAt: string;
        expiresAt: string;
        reporterId: string | null;
        distanceKm?: number;
      }>;
    }>(`/hazards?${q.toString()}`);
  },

  createCaregiverLink(payload: { caregiverEmail: string }) {
    return jsonRequest<{ link: { id: string; caregiverEmail: string; status: string } }>(
      "/caregiver/link",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  grantCaregiverLink(linkId: string) {
    return jsonRequest<{ link: unknown }>(`/caregiver/link/${linkId}/grant`, {
      method: "POST",
    });
  },

  revokeCaregiverLink(linkId: string) {
    return jsonRequest<{ link: unknown }>(`/caregiver/link/${linkId}/revoke`, {
      method: "POST",
    });
  },

  caregiverLinks() {
    return jsonRequest<{
      links: Array<{
        id: string;
        caregiverEmail: string;
        status: string;
        consentGranted: boolean;
        createdAt: string;
        grantedAt: string | null;
      }>;
    }>("/caregiver/links");
  },

  caregiverTranscript(linkId: string, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers["x-beacon-transcript-token"] = token;
    return jsonRequest<{
      link: { id: string; caregiverEmail: string };
      transcriptToken: string;
      entries: Array<{
        id: string;
        tier: string;
        text: string;
        at: string;
        geolocation: { lat: number; lng: number } | null;
      }>;
    }>(`/caregiver/${linkId}/transcript`, { headers });
  },

  health() {
    return jsonRequest<{ status: string; timestamp: string }>("/health");
  },
};
