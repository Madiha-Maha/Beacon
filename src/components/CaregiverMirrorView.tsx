/**
 * Beacon — Real-Time AI Sight Companion
 * Caregiver Mirror Mode View
 * Calm, ultra-legible low-bandwidth text transcript monitoring tool
 */

import React, { useEffect, useState } from "react";
import { CaregiverLink, NarrationLogEntry } from "../types.ts";

interface Props {
  onSpeakText: (text: string) => void;
  incomingLog?: NarrationLogEntry | null;
}

export const CaregiverMirrorView: React.FC<Props> = ({ onSpeakText, incomingLog }) => {
  const [links, setLinks] = useState<CaregiverLink[]>([]);
  const [logs, setLogs] = useState<NarrationLogEntry[]>([]);
  const [caregiverEmail, setCaregiverEmail] = useState<string>("");
  const [activeLinkId, setActiveLinkId] = useState<string>("default");
  const [consentGranted, setConsentGranted] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchLinksAndTranscript = async () => {
    setLoading(true);
    try {
      // Fetch links
      const linkRes = await fetch("/caregiver/links");
      if (linkRes.ok) {
        const data = await linkRes.json();
        setLinks(data.links || []);
      }

      // Fetch transcript logs
      const transcriptRes = await fetch("/caregiver/default/transcript");
      if (transcriptRes.ok) {
        const tData = await transcriptRes.json();
        setLogs(tData.logs || []);
        setConsentGranted(tData.consentGranted);
      }
    } catch (e) {
      console.warn("Failed to load caregiver data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinksAndTranscript();
  }, []);

  // Append real-time incoming log if active
  useEffect(() => {
    if (incomingLog) {
      setLogs((prev) => [incomingLog, ...prev.slice(0, 49)]);
    }
  }, [incomingLog]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caregiverEmail) return;

    try {
      const res = await fetch("/caregiver/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caregiverEmail }),
      });
      if (res.ok) {
        const data = await res.json();
        setLinks((prev) => [data.link, ...prev]);
        setCaregiverEmail("");
        onSpeakText(`Caregiver link generated for ${caregiverEmail}`);
      }
    } catch (err) {
      console.warn("Failed to create link:", err);
    }
  };

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/?mode=caregiver&token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(token);
    setTimeout(() => setCopiedLink(null), 3000);
    onSpeakText("Caregiver mirror link copied to clipboard.");
  };

  return (
    <div className="w-full flex flex-col gap-4" id="caregiver-mirror-container">
      {/* Caregiver Header Card */}
      <div className="bg-[#14181D] border border-[#232A32] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-base font-bold text-[#F5F5F5]">Caregiver Mirror Mode</h2>
            <span className="text-[10px] font-mono uppercase bg-[#232A32] text-[#8E9CAE] px-2 py-0.5 rounded">
              Low-Bandwidth Stream
            </span>
          </div>
          <p className="text-xs text-[#8E9CAE] mt-1">
            Consensual live text transcript of Beacon sight narration for peace of mind.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[#8E9CAE] cursor-pointer bg-[#0B0E11] px-3 py-1.5 rounded-lg border border-[#232A32]">
            <input
              type="checkbox"
              checked={consentGranted}
              onChange={(e) => setConsentGranted(e.target.checked)}
              className="accent-[#FFB84C] w-4 h-4 rounded"
            />
            <span>Broadcasting Consent Active</span>
          </label>
        </div>
      </div>

      {/* Share / Invite Caregiver Bar */}
      <form
        onSubmit={handleCreateLink}
        className="bg-[#14181D] border border-[#232A32] rounded-xl p-3 flex flex-col sm:flex-row items-center gap-2"
      >
        <input
          type="email"
          placeholder="Caregiver's email address (e.g., family@home.org)..."
          value={caregiverEmail}
          onChange={(e) => setCaregiverEmail(e.target.value)}
          className="w-full bg-[#0B0E11] border border-[#232A32] text-[#F5F5F5] rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#FFB84C] outline-none"
        />
        <button
          type="submit"
          className="w-full sm:w-auto shrink-0 px-4 py-2 bg-[#FFB84C] text-[#0B0E11] font-bold text-xs rounded-lg hover:bg-[#ffa726] transition-colors"
        >
          Authorize Link
        </button>
      </form>

      {/* Authorized Links List */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-2 bg-[#14181D] border border-[#232A32] px-3 py-1.5 rounded-lg text-xs"
            >
              <span className="text-[#8E9CAE] font-medium">{link.caregiverEmail}</span>
              <button
                type="button"
                onClick={() => copyShareLink(link.token)}
                className="text-[#FFB84C] hover:underline font-bold text-[11px]"
              >
                {copiedLink === link.token ? "✓ Copied" : "Copy Mirror URL"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Calm Plain Text Transcript Feed */}
      <div className="bg-[#0B0E11] border-2 border-[#232A32] rounded-xl p-4 flex flex-col gap-3 min-h-[360px] max-h-[520px] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#232A32] pb-2 text-xs text-[#8E9CAE]">
          <span className="font-mono text-[#FFB84C]">LIVE AUDIT FEED (CHRONOLOGICAL)</span>
          <span>{logs.length} events logged</span>
        </div>

        {loading ? (
          <div className="text-center text-[#8E9CAE] text-xs py-10">Connecting to transcript feed...</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-[#8E9CAE] text-xs py-10">
            No narration events yet. Start the sight companion to generate transcript.
          </div>
        ) : (
          logs.map((item) => {
            const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-1 p-3 rounded-lg border transition-colors ${
                  item.tier === "hazard"
                    ? "bg-[#FF4D4D]/10 border-[#FF4D4D]/40 text-[#F5F5F5]"
                    : item.tier === "social"
                    ? "bg-[#38BDF8]/10 border-[#38BDF8]/40 text-[#F5F5F5]"
                    : "bg-[#14181D] border-[#232A32] text-[#E0E6ED]"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono opacity-80">
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.tier === "hazard"
                          ? "bg-[#FF4D4D]"
                          : item.tier === "social"
                          ? "bg-[#38BDF8]"
                          : "bg-emerald-400"
                      }`}
                    />
                    <span className="uppercase font-bold tracking-wider">{item.tier}</span>
                    {item.hapticPattern && (
                      <span className="text-[10px] text-[#8E9CAE]">[{item.hapticPattern}]</span>
                    )}
                  </span>
                  <span>{timeStr}</span>
                </div>

                <p className="text-sm font-medium tracking-wide mt-0.5 leading-relaxed">
                  {item.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
