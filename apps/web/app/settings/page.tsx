"use client";

import Link from "next/link";
import clsx from "clsx";
import { useState, useEffect } from "react";
import { beaconApi } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [links, setLinks] = useState<
    Array<{
      id: string;
      caregiverEmail: string;
      status: string;
      consentGranted: boolean;
      createdAt: string;
      grantedAt: string | null;
    }>
  >([]);
  const [newCaregiverEmail, setNewCaregiverEmail] = useState("");
  const [linksError, setLinksError] = useState<string | null>(null);
  const [linksBusy, setLinksBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await beaconApi.caregiverLinks();
        setLinks(res.links);
      } catch {
        // ignore unauthenticated
      }
    })();
  }, []);

  const addLink = async () => {
    setLinksError(null);
    setLinksBusy(true);
    try {
      await beaconApi.createCaregiverLink({ caregiverEmail: newCaregiverEmail });
      setNewCaregiverEmail("");
      const res = await beaconApi.caregiverLinks();
      setLinks(res.links);
    } catch (e) {
      setLinksError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLinksBusy(false);
    }
  };

  const grant = async (id: string) => {
    await beaconApi.grantCaregiverLink(id);
    const res = await beaconApi.caregiverLinks();
    setLinks(res.links);
  };
  const revoke = async (id: string) => {
    await beaconApi.revokeCaregiverLink(id);
    const res = await beaconApi.caregiverLinks();
    setLinks(res.links);
  };

  const testTts = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(
      "This is Beacon. Hazards are spoken first, then social cues, then ambient detail."
    );
    u.rate = settings.voiceRate;
    u.pitch = settings.voicePitch;
    if (settings.selectedVoiceUri) {
      const v = voices.find((x) => x.voiceURI === settings.selectedVoiceUri);
      if (v) u.voice = v;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  return (
    <main className="min-h-screen flex flex-col px-4 py-6 md:px-8 md:py-10 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/90" />
          <span className="font-bold text-lg">Beacon</span>
        </Link>
        <nav className="flex gap-2 text-sm">
          <Link href="/live" className="btn-ghost !py-1.5 !px-3">
            Live
          </Link>
          <Link href="/hazard-map" className="btn-ghost !py-1.5 !px-3">
            Hazard map
          </Link>
        </nav>
      </header>

      <h1 className="text-2xl mb-6">Settings</h1>

      <section className="space-y-6">
        <div className="surface p-5">
          <h2 className="text-lg font-bold mb-4">Display</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">High-contrast mode</div>
              <div className="text-sm text-text-dim">
                Maximum legibility for low-vision users.
              </div>
            </div>
            <button
              type="button"
              className={clsx(
                "w-16 h-9 rounded-full relative transition-colors",
                settings.contrast === "high" ? "bg-primary" : "bg-bg-border"
              )}
              onClick={() =>
                updateSettings({
                  contrast: settings.contrast === "high" ? "normal" : "high",
                })
              }
              aria-pressed={settings.contrast === "high"}
            >
              <span
                className={clsx(
                  "absolute top-1 w-7 h-7 rounded-full bg-white transition-transform",
                  settings.contrast === "high" ? "translate-x-8" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>

        <div className="surface p-5">
          <h2 className="text-lg font-bold mb-4">Voice & Narration</h2>
          <label className="block mb-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-semibold">Speaking rate</span>
              <span className="text-text-dim text-sm">
                {settings.voiceRate.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.8}
              step={0.05}
              value={settings.voiceRate}
              onChange={(e) => updateSettings({ voiceRate: Number(e.target.value) })}
              className="w-full"
            />
          </label>
          <label className="block mb-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-semibold">Voice pitch</span>
              <span className="text-text-dim text-sm">
                {settings.voicePitch.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.05}
              value={settings.voicePitch}
              onChange={(e) => updateSettings({ voicePitch: Number(e.target.value) })}
              className="w-full"
            />
          </label>
          <label className="block mb-4">
            <span className="block mb-1 font-semibold">Voice</span>
            <select
              className="input-field"
              value={settings.selectedVoiceUri ?? ""}
              onChange={(e) =>
                updateSettings({
                  selectedVoiceUri: e.target.value || null,
                })
              }
            >
              <option value="">Default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang}) {v.localService ? "· local" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="flex items-center justify-between surface p-3">
              <span className="font-semibold text-sm">TTS voice</span>
              <input
                type="checkbox"
                checked={settings.ttsEnabled}
                onChange={(e) => updateSettings({ ttsEnabled: e.target.checked })}
                className="w-5 h-5"
              />
            </label>
            <label className="flex items-center justify-between surface p-3">
              <span className="font-semibold text-sm">Ambient detail</span>
              <input
                type="checkbox"
                checked={settings.ambientNarration}
                onChange={(e) => updateSettings({ ambientNarration: e.target.checked })}
                className="w-5 h-5"
              />
            </label>
            <label className="flex items-center justify-between surface p-3">
              <span className="font-semibold text-sm">Haptics</span>
              <input
                type="checkbox"
                checked={settings.hapticsEnabled}
                onChange={(e) => updateSettings({ hapticsEnabled: e.target.checked })}
                className="w-5 h-5"
              />
            </label>
          </div>
          <div className="mt-5">
            <button type="button" className="btn-primary" onClick={testTts}>
              Test voice
            </button>
          </div>
        </div>

        <div className="surface p-5">
          <h2 className="text-lg font-bold mb-2">Camera sample rate</h2>
          <p className="text-text-dim text-sm mb-4">
            How often a frame is sent to the narration engine. Lower intervals
            drain battery faster.
          </p>
          <label className="block">
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-semibold">Frame interval</span>
              <span className="text-text-dim text-sm">
                {(settings.frameIntervalMs / 1000).toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={800}
              max={4000}
              step={100}
              value={settings.frameIntervalMs}
              onChange={(e) =>
                updateSettings({ frameIntervalMs: Number(e.target.value) })
              }
              className="w-full"
            />
          </label>
        </div>

        <div className="surface p-5">
          <h2 className="text-lg font-bold mb-2">Caregiver links</h2>
          <p className="text-text-dim text-sm mb-4">
            Send a Mirror Mode link to a trusted person so they can (with your
            consent) view a low-bandwidth text transcript of Beacon's
            narration.
          </p>
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              className="input-field flex-1"
              placeholder="caregiver@example.com"
              value={newCaregiverEmail}
              onChange={(e) => setNewCaregiverEmail(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              disabled={linksBusy || !newCaregiverEmail}
              onClick={addLink}
            >
              {linksBusy ? "…" : "Create link"}
            </button>
          </div>
          {linksError && <div className="text-hazard mb-3">{linksError}</div>}

          {links.length === 0 ? (
            <div className="text-text-dim text-sm">No caregiver links yet.</div>
          ) : (
            <ul className="space-y-2">
              {links.map((l) => (
                <li
                  key={l.id}
                  className="surface p-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between"
                >
                  <div>
                    <div className="font-semibold">{l.caregiverEmail}</div>
                    <div className="text-xs text-text-dim">
                      {l.status} · created {new Date(l.createdAt).toLocaleDateString()}
                    </div>
                    {l.consentGranted && (
                      <Link
                        href={`/caregiver/${l.id}`}
                        className="text-primary text-xs underline underline-offset-2"
                      >
                        Open Mirror Mode preview →
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!l.consentGranted && l.status !== "revoked" && (
                      <button
                        type="button"
                        className="btn-primary !py-1.5 !px-3 text-sm"
                        onClick={() => grant(l.id)}
                      >
                        Grant consent
                      </button>
                    )}
                    {l.consentGranted && (
                      <button
                        type="button"
                        className="btn-ghost !py-1.5 !px-3 text-sm"
                        onClick={() => revoke(l.id)}
                      >
                        Revoke
                      </button>
                    )}
                    {l.status === "revoked" && (
                      <span className="text-hazard text-sm self-center">Revoked</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
