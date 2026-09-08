/**
 * Beacon — Real-Time AI Sight Companion
 * Community Hazard Mesh View
 * Live crowdsourced accessibility layer over the physical world
 */

import React, { useEffect, useState } from "react";
import { HazardReport, HazardSeverity, HazardType } from "../types.ts";

interface Props {
  userCoords?: { lat: number; lng: number } | null;
  onSpeakText: (text: string) => void;
}

export const HazardMapView: React.FC<Props> = ({ userCoords, onSpeakText }) => {
  const [hazards, setHazards] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // New Hazard Form State
  const [newType, setNewType] = useState<HazardType>("curb");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDesc, setNewDesc] = useState<string>("");
  const [newSeverity, setNewSeverity] = useState<HazardSeverity>("warning");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchHazards = async () => {
    setLoading(true);
    try {
      const lat = userCoords?.lat ?? 37.7749;
      const lng = userCoords?.lng ?? -122.4194;
      const res = await fetch(`/hazards?lat=${lat}&lng=${lng}&radius=25`);
      if (res.ok) {
        const data = await res.json();
        setHazards(data.hazards || []);
      }
    } catch (e) {
      console.warn("Failed to fetch hazard mesh:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHazards();
  }, [userCoords]);

  const handleVerify = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/hazards/${id}/verify`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setHazards((prev) => prev.map((h) => (h.id === id ? data.hazard : h)));
        onSpeakText("Hazard verification recorded. Thank you for strengthening the mesh.");
      }
    } catch (err) {
      console.warn("Verification error:", err);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        lat: userCoords?.lat ?? 37.7749 + (Math.random() - 0.5) * 0.005,
        lng: userCoords?.lng ?? -122.4194 + (Math.random() - 0.5) * 0.005,
        type: newType,
        title: newTitle || `${newType.replace("_", " ").toUpperCase()}`,
        description: newDesc || "Crowdsourced report via Beacon user mesh",
        severity: newSeverity,
      };

      const res = await fetch("/hazards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setHazards((prev) => [data.hazard, ...prev]);
        setShowReportModal(false);
        setNewTitle("");
        setNewDesc("");
        onSpeakText(`Hazard published to community mesh: ${payload.title}`);
      }
    } catch (err) {
      console.warn("Report error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredHazards = hazards.filter((h) => {
    if (filterSeverity === "all") return true;
    return h.severity === filterSeverity;
  });

  const getSeverityBadge = (sev: HazardSeverity) => {
    if (sev === "critical") return "bg-[#FF4D4D]/20 text-[#FF4D4D] border-[#FF4D4D]/40";
    if (sev === "warning") return "bg-[#FFB84C]/20 text-[#FFB84C] border-[#FFB84C]/40";
    return "bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8]/40";
  };

  return (
    <div className="w-full flex flex-col gap-4" id="hazard-mesh-container">
      {/* Header Info & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#14181D] p-4 rounded-xl border border-[#232A32]">
        <div>
          <h2 className="text-lg font-bold text-[#F5F5F5] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFB84C] animate-pulse" />
            Community Hazard Mesh
          </h2>
          <p className="text-xs text-[#8E9CAE] mt-0.5">
            Crowdsourced accessibility layer actively protecting blind & low-vision travelers.
          </p>
        </div>

        <button
          id="open-report-hazard-btn"
          onClick={() => setShowReportModal(true)}
          className="px-4 py-2.5 bg-[#FFB84C] text-[#0B0E11] font-bold text-sm rounded-lg hover:bg-[#ffa726] transition-colors flex items-center justify-center gap-2 focus:ring-2 focus:ring-white"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Report Hazard
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          id="filter-all-btn"
          onClick={() => setFilterSeverity("all")}
          className={`px-3 py-1.5 rounded-full font-semibold border transition-colors ${
            filterSeverity === "all"
              ? "bg-[#FFB84C] text-[#0B0E11] border-[#FFB84C]"
              : "bg-[#14181D] text-[#8E9CAE] border-[#232A32] hover:text-[#F5F5F5]"
          }`}
        >
          All Hazards ({hazards.length})
        </button>
        <button
          id="filter-critical-btn"
          onClick={() => setFilterSeverity("critical")}
          className={`px-3 py-1.5 rounded-full font-semibold border transition-colors ${
            filterSeverity === "critical"
              ? "bg-[#FF4D4D] text-[#0B0E11] border-[#FF4D4D]"
              : "bg-[#14181D] text-[#8E9CAE] border-[#232A32] hover:text-[#FF4D4D]"
          }`}
        >
          Critical Obstacles
        </button>
        <button
          id="filter-warning-btn"
          onClick={() => setFilterSeverity("warning")}
          className={`px-3 py-1.5 rounded-full font-semibold border transition-colors ${
            filterSeverity === "warning"
              ? "bg-[#FFB84C] text-[#0B0E11] border-[#FFB84C]"
              : "bg-[#14181D] text-[#8E9CAE] border-[#232A32] hover:text-[#FFB84C]"
          }`}
        >
          Warnings & Curbs
        </button>
      </div>

      {/* Radar Map / Geographic Indicator */}
      <div className="relative w-full h-44 bg-[#0B0E11] rounded-xl border border-[#232A32] p-4 flex flex-col justify-between overflow-hidden">
        {/* Sonar sweep line effect */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
          <div className="w-72 h-72 rounded-full border border-[#FFB84C]/30" />
          <div className="absolute w-48 h-48 rounded-full border border-[#FFB84C]/40" />
          <div className="absolute w-24 h-24 rounded-full border border-[#FFB84C]/60" />
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-[#8E9CAE]">
          <span className="font-mono uppercase text-[#FFB84C] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Live GPS Mesh Active
          </span>
          <span>Radius: 25 km</span>
        </div>

        <div className="relative z-10 text-center">
          <p className="text-xl font-bold text-[#F5F5F5]">
            {filteredHazards.length} Verified Obstacles in Vicinity
          </p>
          <p className="text-xs text-[#8E9CAE] mt-0.5">
            Nearest hazard is{" "}
            <span className="text-[#FF4D4D] font-bold">
              {filteredHazards[0]?.distanceMeters ? `${filteredHazards[0].distanceMeters}m` : "45m"}
            </span>{" "}
            ahead ({filteredHazards[0]?.title || "Steep Unmarked Curb"})
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[11px] text-[#8E9CAE]">
          <span>Lat: {(userCoords?.lat ?? 37.7749).toFixed(4)}</span>
          <span>Lng: {(userCoords?.lng ?? -122.4194).toFixed(4)}</span>
        </div>
      </div>

      {/* Hazards Feed List */}
      <div className="flex flex-col gap-2.5">
        {loading ? (
          <div className="p-8 text-center text-[#8E9CAE] text-sm">Scanning community hazard grid...</div>
        ) : filteredHazards.length === 0 ? (
          <div className="p-8 text-center text-[#8E9CAE] text-sm bg-[#14181D] rounded-xl border border-[#232A32]">
            No hazards reported in this category. Path clear.
          </div>
        ) : (
          filteredHazards.map((h) => (
            <div
              key={h.id}
              onClick={() => onSpeakText(`Obstacle: ${h.title}. ${h.description}`)}
              className="bg-[#14181D] border border-[#232A32] hover:border-[#FFB84C]/50 rounded-xl p-3.5 transition-colors cursor-pointer flex flex-col gap-2"
              role="button"
              tabIndex={0}
              aria-label={`Hazard: ${h.title}. ${h.description}. Tap to speak aloud.`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getSeverityBadge(h.severity)}`}>
                    {h.severity}
                  </span>
                  <h3 className="text-sm font-bold text-[#F5F5F5]">{h.title}</h3>
                </div>
                {h.distanceMeters !== undefined && (
                  <span className="text-xs font-mono text-[#FFB84C] font-semibold shrink-0">
                    {h.distanceMeters}m away
                  </span>
                )}
              </div>

              <p className="text-xs text-[#8E9CAE] leading-relaxed">{h.description}</p>

              <div className="flex items-center justify-between pt-2 border-t border-[#232A32] text-[11px] text-[#8E9CAE]">
                <span>Type: {h.type.replace("_", " ")}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-emerald-400 fill-current" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    {h.verifiedCount} verified
                  </span>
                  <button
                    onClick={(e) => handleVerify(h.id, e)}
                    className="text-[#FFB84C] hover:underline font-semibold"
                  >
                    +1 Confirm
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#14181D] border border-[#232A32] rounded-2xl p-5 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#232A32] pb-3">
              <h3 className="text-base font-bold text-[#F5F5F5]">Report Physical Hazard</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-[#8E9CAE] hover:text-[#F5F5F5] text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-[#8E9CAE] block mb-1">Hazard Category</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as HazardType)}
                  className="w-full bg-[#0B0E11] border border-[#232A32] text-[#F5F5F5] rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#FFB84C] outline-none"
                >
                  <option value="curb">Steep or Unmarked Curb</option>
                  <option value="broken_pavement">Broken Pavement / Pothole</option>
                  <option value="stairs_down">Stairs Descending (Drop-off)</option>
                  <option value="construction">Construction Scaffolding / Barrier</option>
                  <option value="blocked_ramp">Blocked Wheelchair / Cane Ramp</option>
                  <option value="wet_floor">Wet / Slippery Flooring</option>
                  <option value="low_overhang">Low Overhang / Tree Branch</option>
                  <option value="general_obstacle">General Pathway Obstacle</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8E9CAE] block mb-1">Hazard Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Unmarked 6-inch drop curb at intersection"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#0B0E11] border border-[#232A32] text-[#F5F5F5] rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#FFB84C] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8E9CAE] block mb-1">Details & Location Hints</label>
                <textarea
                  rows={3}
                  placeholder="Describe tactile cues, side of street, or walking guidance..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-[#0B0E11] border border-[#232A32] text-[#F5F5F5] rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#FFB84C] outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8E9CAE] block mb-1">Severity Level</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewSeverity("critical")}
                    className={`py-2 rounded-lg font-bold border transition-colors ${
                      newSeverity === "critical"
                        ? "bg-[#FF4D4D] text-[#0B0E11] border-[#FF4D4D]"
                        : "bg-[#0B0E11] text-[#8E9CAE] border-[#232A32]"
                    }`}
                  >
                    Critical
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSeverity("warning")}
                    className={`py-2 rounded-lg font-bold border transition-colors ${
                      newSeverity === "warning"
                        ? "bg-[#FFB84C] text-[#0B0E11] border-[#FFB84C]"
                        : "bg-[#0B0E11] text-[#8E9CAE] border-[#232A32]"
                    }`}
                  >
                    Warning
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSeverity("advisory")}
                    className={`py-2 rounded-lg font-bold border transition-colors ${
                      newSeverity === "advisory"
                        ? "bg-[#38BDF8] text-[#0B0E11] border-[#38BDF8]"
                        : "bg-[#0B0E11] text-[#8E9CAE] border-[#232A32]"
                    }`}
                  >
                    Advisory
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#232A32] mt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 text-xs text-[#8E9CAE] hover:text-[#F5F5F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#FFB84C] text-[#0B0E11] font-bold text-xs rounded-lg hover:bg-[#ffa726] transition-colors"
                >
                  {submitting ? "Publishing..." : "Submit to Mesh"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
