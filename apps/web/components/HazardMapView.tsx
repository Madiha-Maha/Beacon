"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { beaconApi } from "@/lib/api-client";

type Hazard = {
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
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "bg-ambient/80",
  medium: "bg-primary",
  high: "bg-hazard/80",
  critical: "bg-hazard",
};

const TYPE_LABEL: Record<string, string> = {
  stairs: "Stairs",
  curb: "Curb",
  vehicle: "Vehicle hazard",
  obstacle: "Obstacle",
  wet_floor: "Wet floor",
  hole: "Hole / pothole",
  drop_off: "Drop-off",
  construction: "Construction",
  blocked_ramp: "Blocked ramp",
  broken_pavement: "Broken pavement",
  other: "Other",
};

export default function HazardMapView() {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(0.5);
  const [center, setCenter] = useState<{ lat: number; lng: number; label: string } | null>(
    null
  );
  const [count, setCount] = useState(0);

  const askLocationAndLoad = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!navigator.geolocation) throw new Error("Geolocation is unavailable");
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12_000,
        });
      });
      const c = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        label: "Your current location",
      };
      setCenter(c);
      const res = await beaconApi.nearbyHazards({
        lat: c.lat,
        lng: c.lng,
        radiusKm,
      });
      setHazards(res.hazards as Hazard[]);
      setCount(res.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load hazard map");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (center) {
      setLoading(true);
      beaconApi
        .nearbyHazards({ lat: center.lat, lng: center.lng, radiusKm })
        .then((r) => {
          setHazards(r.hazards as Hazard[]);
          setCount(r.count);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
        .finally(() => setLoading(false));
    }
  }, [radiusKm, center?.lat, center?.lng]);

  const mapLat = center?.lat ?? 0;
  const mapLng = center?.lng ?? 0;

  return (
    <div className="space-y-5">
      <div className="surface p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-text-dim mb-1">Center</div>
          <div className="font-semibold truncate">
            {center
              ? `${center.label} · ${mapLat.toFixed(4)}, ${mapLng.toFixed(4)}`
              : "Not yet localized"}
          </div>
        </div>
        <label className="block sm:w-56">
          <div className="text-sm text-text-dim mb-1">Radius: {radiusKm.toFixed(1)} km</div>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="w-full"
            disabled={!center}
          />
        </label>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={askLocationAndLoad}
          disabled={loading}
        >
          {loading ? "Updating…" : center ? "Refresh near me" : "Locate me"}
        </button>
      </div>

      {error && (
        <div className="surface p-4 border-hazard/50 border-l-4 tier-hazard">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="surface overflow-hidden lg:col-span-3 aspect-[4/3] relative">
          {center ? (
            <>
              <iframe
                title="Hazard Mesh Map"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
                  `${mapLng - (radiusKm / 80)},${mapLat - (radiusKm / 111)},${mapLng + (radiusKm / 80)},${mapLat + (radiusKm / 111)}`
                )}&layer=mapnik&marker=${encodeURIComponent(`${mapLat},${mapLng}`)}`}
              />
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-signal-glow" />
                {hazards.slice(0, 30).map((h) => {
                  const dy = (h.lat - mapLat) / (radiusKm / 111);
                  const dx = (h.lng - mapLng) / (radiusKm / 80);
                  if (Math.abs(dx) > 0.98 || Math.abs(dy) > 0.98) return null;
                  return (
                    <div
                      key={h.id}
                      className={clsx(
                        "absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full ring-2 ring-white/70",
                        SEVERITY_COLOR[h.severity] ?? SEVERITY_COLOR.medium
                      )}
                      style={{
                        left: `${50 + dx * 50}%`,
                        top: `${50 - dy * 50}%`,
                      }}
                      title={`${TYPE_LABEL[h.type] ?? h.type} · ${h.severity}`}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-dim text-center p-6">
              <div>
                <div className="text-lg font-bold mb-1">Enable your location</div>
                Press <span className="text-primary font-semibold">Locate me</span> to see
                nearby hazard reports.
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-bold">Nearby reports</h2>
            <div className="text-sm text-text-dim tabular-nums">
              {count} result{count === 1 ? "" : "s"}
            </div>
          </div>
          {hazards.length === 0 ? (
            <div className="surface p-6 text-text-dim text-center">
              {loading
                ? "Fetching reports…"
                : center
                  ? "No hazards reported nearby."
                  : "Localize to see reports."}
            </div>
          ) : (
            <ul className="space-y-2 max-h-[560px] overflow-auto pr-1">
              {hazards.map((h) => (
                <li key={h.id} className="surface p-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={clsx(
                        "mt-1.5 w-3 h-3 shrink-0 rounded-full",
                        SEVERITY_COLOR[h.severity] ?? SEVERITY_COLOR.medium
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-semibold">
                          {TYPE_LABEL[h.type] ?? h.type.replace("_", " ")}
                        </div>
                        <div className="text-xs text-text-dim uppercase tracking-wide">
                          {h.severity}
                        </div>
                      </div>
                      <div className="text-xs text-text-dim tabular-nums">
                        {h.distanceKm != null
                          ? `${(h.distanceKm * 1000).toFixed(0)} m away`
                          : `${h.lat.toFixed(4)}, ${h.lng.toFixed(4)}`}
                        {" · "}
                        {new Date(h.reportedAt).toLocaleString()}
                      </div>
                      {h.notes && (
                        <div className="text-sm text-text mt-1">{h.notes}</div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
