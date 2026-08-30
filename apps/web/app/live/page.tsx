"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { TriageOutput } from "@beacon/shared/types";
import ListeningIndicator from "@/components/ListeningIndicator";
import NarrationStreamHandler from "@/components/NarrationStreamHandler";
import { beaconApi } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";

interface NarrationEntry extends TriageOutput {
  id: string;
  at: number;
}

const TIER_LABEL: Record<TriageOutput["tier"], string> = {
  hazard: "Hazard",
  social: "Social",
  ambient: "Ambient",
};

export default function LivePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [log, setLog] = useState<NarrationEntry[]>([]);
  const [hazardReportOpen, setHazardReportOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState<"idle" | "ok" | "err">("idle");
  const [hazardType, setHazardType] = useState("obstacle");
  const [hazardSeverity, setHazardSeverity] = useState("medium");
  const [hazardNotes, setHazardNotes] = useState("");

  const listeningState = useAppStore((s) => s.listeningState);
  const setListeningState = useAppStore((s) => s.setListeningState);
  const lastError = useAppStore((s) => s.lastError);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const pushNarration = (out: TriageOutput) => {
    setLog((prev) => [
      { ...out, id: Math.random().toString(36).slice(2), at: Date.now() },
      ...prev,
    ].slice(0, 40));
  };

  const toggleListening = () => {
    if (listeningState === "listening" || listeningState === "requesting") {
      setListeningState("idle");
    } else {
      setListeningState("requesting");
    }
  };

  const submitHazardReport = async () => {
    setReportStatus("idle");
    const geoErr = new Error("Could not determine current location");
    if (typeof navigator === "undefined" || !navigator.geolocation) throw geoErr;
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10_000,
      });
    });

    try {
      await beaconApi.reportHazard({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        type: hazardType,
        severity: hazardSeverity,
        notes: hazardNotes || undefined,
      });
      setReportStatus("ok");
      setHazardReportOpen(false);
      setHazardNotes("");
      setTimeout(() => setReportStatus("idle"), 2500);
    } catch {
      setReportStatus("err");
    }
  };

  return (
    <main className="min-h-screen flex flex-col px-4 py-6 md:px-8 md:py-10 max-w-4xl mx-auto">
      <NarrationStreamHandler videoRef={videoRef} onNarration={pushNarration} />

      <header className="flex items-center justify-between mb-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/90" />
          <span className="font-bold text-lg">Beacon</span>
        </Link>
        <nav className="flex gap-2 text-sm">
          <Link href="/hazard-map" className="btn-ghost !py-1.5 !px-3">
            Hazard map
          </Link>
          <Link href="/settings" className="btn-ghost !py-1.5 !px-3">
            Settings
          </Link>
        </nav>
      </header>

      <section className="flex flex-col items-center gap-6">
        <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden border border-bg-border bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className="w-full h-full object-cover"
            aria-label="Camera preview"
          />
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur rounded-full px-3 py-1 text-xs font-semibold border border-white/10">
            <span
              className={clsx(
                "w-2 h-2 rounded-full",
                listeningState === "listening" ? "bg-primary animate-pulse" : "bg-text-dim"
              )}
            />
            {listeningState === "listening" ? "Camera live" : "Camera paused"}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={toggleListening}
            aria-pressed={listeningState === "listening"}
            className="focus:outline-none"
          >
            <ListeningIndicator size="lg" />
          </button>
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              type="button"
              className="btn-ghost"
              onClick={toggleListening}
            >
              {listeningState === "listening" ? "Pause" : "Start listening"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setHazardReportOpen((v) => !v)}
            >
              Report a hazard
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => updateSettings({ ttsEnabled: !settings.ttsEnabled })}
            >
              Voice: {settings.ttsEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {lastError && (
          <div className="w-full surface p-4 border-hazard/50 tier-hazard border-l-4">
            <div className="text-sm font-semibold uppercase tracking-wide mb-1">Issue</div>
            <div>{lastError}</div>
          </div>
        )}

        {hazardReportOpen && (
          <div className="w-full surface p-5 animate-tier-fade">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Report a hazard</h2>
              <button
                type="button"
                className="btn-ghost !py-1.5 !px-3 text-sm"
                onClick={() => setHazardReportOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block mb-1 text-sm text-text-dim">Type</span>
                <select
                  className="input-field"
                  value={hazardType}
                  onChange={(e) => setHazardType(e.target.value)}
                >
                  {[
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
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block mb-1 text-sm text-text-dim">Severity</span>
                <select
                  className="input-field"
                  value={hazardSeverity}
                  onChange={(e) => setHazardSeverity(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>
            <label className="block mt-4">
              <span className="block mb-1 text-sm text-text-dim">
                Notes (optional)
              </span>
              <textarea
                className="input-field min-h-[80px]"
                value={hazardNotes}
                onChange={(e) => setHazardNotes(e.target.value)}
                maxLength={500}
              />
            </label>
            <div className="flex gap-3 mt-4 items-center">
              <button
                type="button"
                className="btn-primary"
                onClick={submitHazardReport}
              >
                Submit using my location
              </button>
              {reportStatus === "ok" && (
                <span className="text-primary font-semibold">Reported ✓</span>
              )}
              {reportStatus === "err" && (
                <span className="text-hazard font-semibold">
                  Failed to report
                </span>
              )}
            </div>
          </div>
        )}

        <section className="w-full">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-bold">Narration log</h2>
            {log.length > 0 && (
              <button
                type="button"
                className="text-sm text-text-dim hover:text-text"
                onClick={() => setLog([])}
              >
                Clear
              </button>
            )}
          </div>
          {log.length === 0 ? (
            <div className="surface p-6 text-center text-text-dim">
              Press <span className="text-primary font-semibold">Start listening</span>{" "}
              to begin narration.
            </div>
          ) : (
            <ul className="space-y-2">
              {log.map((entry) => (
                <li
                  key={entry.id}
                  className={clsx(
                    "surface p-3 border-l-4 animate-tier-fade tier-" + entry.tier
                  )}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="text-xs font-bold uppercase tracking-wider">
                      {TIER_LABEL[entry.tier]}
                    </div>
                    <div className="text-xs text-text-dim">
                      {new Date(entry.at).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-text leading-relaxed">{entry.text}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
