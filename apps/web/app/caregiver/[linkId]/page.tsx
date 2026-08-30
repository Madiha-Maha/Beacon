"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import clsx from "clsx";
import { beaconApi } from "@/lib/api-client";

interface TranscriptEntry {
  id: string;
  tier: "hazard" | "social" | "ambient" | string;
  text: string;
  at: string | Date;
  geolocation: { lat: number; lng: number } | null;
  latencyMs?: number;
}

const TIER_BADGE: Record<string, { label: string; classes: string }> = {
  hazard: { label: "HAZARD", classes: "bg-hazard/15 text-hazard border-hazard/40" },
  social: { label: "SOCIAL", classes: "bg-social/15 text-social border-social/40" },
  ambient: { label: "AMBIENT", classes: "bg-bg-elev text-text-dim border-bg-border" },
};

export default function CaregiverMirrorPage() {
  const params = useParams();
  const linkId = params?.linkId as string;
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptToken, setTranscriptToken] = useState<string | null>(null);
  const [linkInfo, setLinkInfo] = useState<{ id: string; caregiverEmail: string } | null>(null);
  const socketRef = useState<Socket | null>(() => null)[0];
  const [socketState, setSocketState] = useState<"idle" | "connecting" | "live" | "error">("idle");

  useEffect(() => {
    if (!linkId) {
      setError("Missing link ID");
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await beaconApi.caregiverTranscript(linkId);
        if (cancelled) return;
        setTranscriptToken(res.transcriptToken);
        setLinkInfo(res.link);
        setEntries(
          res.entries.map((e) => ({ ...e })).sort((a, b) => {
            const ta = new Date(a.at).getTime();
            const tb = new Date(b.at).getTime();
            return tb - ta;
          })
        );
        setLoaded(true);

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";
        const sock = io(wsUrl, { transports: ["websocket"] });
        setSocketState("connecting");
        sock.on("connect", () => {
          setSocketState("live");
          sock.emit("caregiver:subscribe", { linkId });
        });
        sock.on("disconnect", () => setSocketState("idle"));
        sock.on("connect_error", () => setSocketState("error"));
        sock.on("caregiver:transcript", (e: TranscriptEntry) => {
          setEntries((prev) => [e, ...prev].slice(0, 500));
        });
        (socketRef as any).__s = sock;
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      const sock = (socketRef as any).__s as Socket | undefined;
      if (sock) {
        sock.removeAllListeners();
        sock.disconnect();
      }
    };
  }, [linkId]);

  const statusBadge = (() => {
    switch (socketState) {
      case "live":
        return "bg-primary/15 text-primary border-primary/40";
      case "connecting":
        return "bg-social/15 text-social border-social/40";
      case "error":
        return "bg-hazard/15 text-hazard border-hazard/40";
      default:
        return "bg-bg-elev text-text-dim border-bg-border";
    }
  })();

  const statusLabel =
    socketState === "live"
      ? "Live"
      : socketState === "connecting"
        ? "Connecting…"
        : socketState === "error"
          ? "Disconnected"
          : "Idle";

  return (
    <main className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-bg-border">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/90" />
            <div>
              <div className="font-bold leading-tight">Beacon · Mirror Mode</div>
              <div className="text-xs text-text-dim">
                {linkInfo
                  ? `Monitoring consent for ${linkInfo.caregiverEmail}`
                  : "Caregiver monitoring view"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border",
                statusBadge
              )}
            >
              {statusLabel}
            </span>
            <Link href="/settings" className="btn-ghost !py-1.5 !px-3 text-sm">
              User settings
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Hazards" value={entries.filter((e) => e.tier === "hazard").length} tone="hazard" />
          <Stat label="Social cues" value={entries.filter((e) => e.tier === "social").length} tone="social" />
          <Stat label="Entries" value={entries.length} tone="muted" />
        </div>

        {!loaded && (
          <div className="surface p-8 text-center text-text-dim">Loading transcript…</div>
        )}

        {error && (
          <div className="surface p-5 border-hazard/50 border-l-4 tier-hazard">
            <div className="font-semibold">Unable to load</div>
            <div className="text-text-dim">{error}</div>
            <p className="mt-3 text-sm text-text-dim">
              To access Mirror Mode, the user must first grant consent in{" "}
              <Link href="/settings" className="underline text-primary">Settings → Caregiver links</Link>.
            </p>
          </div>
        )}

        {loaded && !error && entries.length === 0 && (
          <div className="surface p-8 text-center text-text-dim">
            No narration entries yet. When the user activates Beacon, entries
            will appear here in chronological order.
          </div>
        )}

        {loaded && !error && entries.length > 0 && (
          <ol className="space-y-2 font-mono text-[15px] leading-relaxed">
            {entries.map((e) => {
              const badge = TIER_BADGE[e.tier] ?? TIER_BADGE.ambient;
              const at = new Date(e.at);
              return (
                <li
                  key={e.id + String(e.at)}
                  className={clsx(
                    "surface p-3 border-l-4 animate-tier-fade tier-" + e.tier
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-md border",
                          badge.classes
                        )}
                      >
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-text-dim tabular-nums">
                        {at.toLocaleString()}
                      </span>
                      {typeof e.latencyMs === "number" && (
                        <span className="text-[11px] text-text-dim">
                          +{e.latencyMs}ms
                        </span>
                      )}
                    </div>
                    {e.geolocation && (
                      <a
                        className="text-[11px] text-text-dim hover:text-primary"
                        href={`https://www.openstreetmap.org/?mlat=${e.geolocation.lat}&mlon=${e.geolocation.lng}#map=18/${e.geolocation.lat}/${e.geolocation.lng}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {e.geolocation.lat.toFixed(4)}, {e.geolocation.lng.toFixed(4)} →
                      </a>
                    )}
                  </div>
                  <div>{e.text}</div>
                </li>
              );
            })}
          </ol>
        )}

        {transcriptToken && (
          <details className="mt-10 text-xs text-text-dim border-t border-bg-border pt-5">
            <summary className="cursor-pointer hover:text-text">
              Transcript access token (for bookmark/share with this caregiver)
            </summary>
            <code className="block mt-2 p-3 bg-bg-elev border border-bg-border rounded-lg break-all">
              x-beacon-transcript-token: {transcriptToken}
            </code>
          </details>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "hazard" | "social" | "muted";
}) {
  const color =
    tone === "hazard"
      ? "text-hazard"
      : tone === "social"
        ? "text-social"
        : "text-text";
  return (
    <div className="surface p-3">
      <div className="text-[10px] uppercase tracking-widest text-text-dim font-bold">
        {label}
      </div>
      <div className={clsx("text-3xl font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}
