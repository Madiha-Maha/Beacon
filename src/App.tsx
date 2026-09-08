/**
 * Beacon — Real-Time AI Sight Companion
 * Main Application Shell & View Coordinator
 */

import React, { useEffect, useState } from "react";
import { NarrationLogEntry, NarrationTier, TriageOutput, UserSettings } from "./types.ts";
import { ListeningIndicator } from "./components/ListeningIndicator.tsx";
import { NarrationStreamHandler } from "./components/NarrationStreamHandler.tsx";
import { HazardMapView } from "./components/HazardMapView.tsx";
import { CaregiverMirrorView } from "./components/CaregiverMirrorView.tsx";
import { SettingsModal } from "./components/SettingsModal.tsx";
import { OnboardingModal } from "./components/OnboardingModal.tsx";

const DEFAULT_SETTINGS: UserSettings = {
  highContrast: false,
  voiceSpeed: 1.1,
  voicePitch: 1.0,
  hapticsEnabled: true,
  speechEnabled: true,
  priorityFilter: "all",
  samplingIntervalMs: 1800,
  offlineDegradedMode: false,
  audioVolume: 1.0,
};

export default function App() {
  // Navigation View Tab: live | hazard-map | caregiver
  const [activeTab, setActiveTab] = useState<"live" | "hazard-map" | "caregiver">("live");

  // Core Companion State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [activeNarration, setActiveNarration] = useState<TriageOutput | null>({
    id: "init-welcome",
    tier: "ambient",
    text: "Beacon sight companion initialized. Tap start to begin ambient vision triage.",
    timestamp: Date.now(),
    detectedObjects: ["open pathway"],
    confidence: 1.0,
  });
  const [narrationHistory, setNarrationHistory] = useState<TriageOutput[]>([]);
  const [audioActive, setAudioActive] = useState<boolean>(false);
  const [systemStatus, setSystemStatus] = useState<string>("Ready");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Settings & Modal State
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem("beacon_settings");
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return !localStorage.getItem("beacon_onboarded");
  });

  // Watch Geolocation for Hazard Mesh
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn("Geolocation fallback to default coords:", err);
          setUserCoords({ lat: 37.7749, lng: -122.4194 });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setUserCoords({ lat: 37.7749, lng: -122.4194 });
    }
  }, []);

  // Synchronize High Contrast mode attribute on HTML root
  useEffect(() => {
    if (settings.highContrast) {
      document.documentElement.setAttribute("data-contrast", "high");
    } else {
      document.documentElement.removeAttribute("data-contrast");
    }
    try {
      localStorage.setItem("beacon_settings", JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const handleUpdateSettings = (partial: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleNarrationReceived = (output: TriageOutput) => {
    setActiveNarration(output);
    setNarrationHistory((prev) => [output, ...prev.slice(0, 24)]);
    setSystemStatus(`Triaged ${output.tier.toUpperCase()} event`);
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.voiceSpeed;
    utterance.volume = settings.audioVolume;
    window.speechSynthesis.speak(utterance);
  };

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("beacon_onboarded", "true");
    setIsListening(true);
    speakText("Beacon active. Scanning your surroundings.");
  };

  const getTierColor = (tier?: NarrationTier) => {
    if (tier === "hazard") return "text-[#FF4D4D] bg-[#FF4D4D]/15 border-[#FF4D4D]/40";
    if (tier === "social") return "text-[#38BDF8] bg-[#38BDF8]/15 border-[#38BDF8]/40";
    return "text-emerald-400 bg-emerald-400/15 border-emerald-400/40";
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-sans transition-colors duration-200">
      {/* Top Accessible Header Bar */}
      <header className="sticky top-0 z-40 bg-[#0B0E11]/90 backdrop-blur-md border-b border-[#232A32] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Emblem */}
            <div className="w-9 h-9 rounded-xl bg-[#FFB84C] text-[#0B0E11] flex items-center justify-center font-black text-lg shadow-md">
              B
            </div>
            <div>
              <h1 className="text-base font-bold text-[#F5F5F5] tracking-tight flex items-center gap-2">
                BEACON
                <span className="text-[10px] font-mono font-normal uppercase px-2 py-0.5 rounded-full bg-[#14181D] text-[#FFB84C] border border-[#232A32]">
                  v1.0 Audio-First
                </span>
              </h1>
              <p className="text-[11px] text-[#8E9CAE] leading-none hidden sm:block">
                Real-Time AI Sight Companion & Hazard Mesh
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2">
            {/* Audio Mute/Unmute Toggle */}
            <button
              id="toggle-speech-btn"
              onClick={() => {
                const next = !settings.speechEnabled;
                handleUpdateSettings({ speechEnabled: next });
                speakText(next ? "Speech narration enabled" : "Speech narration silenced");
              }}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                settings.speechEnabled
                  ? "bg-[#14181D] border-[#232A32] text-[#FFB84C]"
                  : "bg-red-500/20 border-red-500/40 text-red-400"
              }`}
              title={settings.speechEnabled ? "Mute Narration" : "Unmute Narration"}
              aria-label={settings.speechEnabled ? "Mute speech narration" : "Unmute speech narration"}
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                {settings.speechEnabled ? (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                ) : (
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                )}
              </svg>
              <span className="hidden sm:inline">{settings.speechEnabled ? "Voice On" : "Muted"}</span>
            </button>

            {/* Settings Trigger */}
            <button
              id="open-settings-btn"
              onClick={() => setShowSettings(true)}
              className="p-2 bg-[#14181D] hover:bg-[#232A32] border border-[#232A32] rounded-lg text-[#F5F5F5] transition-colors"
              title="Settings & Accessibility"
              aria-label="Open settings and accessibility"
            >
              <svg className="w-4 h-4 fill-current text-[#8E9CAE]" viewBox="0 0 24 24">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Structural Layout */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6" id="main-content">
        {/* Navigation Mode Tabs */}
        <nav
          className="flex items-center justify-between p-1 bg-[#14181D] rounded-xl border border-[#232A32] text-xs font-bold"
          aria-label="Navigation Tabs"
        >
          <button
            id="tab-live-btn"
            onClick={() => setActiveTab("live")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "live"
                ? "bg-[#FFB84C] text-[#0B0E11] shadow"
                : "text-[#8E9CAE] hover:text-[#F5F5F5]"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isListening ? "bg-[#0B0E11]" : "bg-zinc-500"}`} />
            Live Companion
          </button>
          <button
            id="tab-hazard-btn"
            onClick={() => setActiveTab("hazard-map")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "hazard-map"
                ? "bg-[#FFB84C] text-[#0B0E11] shadow"
                : "text-[#8E9CAE] hover:text-[#F5F5F5]"
            }`}
          >
            <span>Community Mesh</span>
          </button>
          <button
            id="tab-caregiver-btn"
            onClick={() => setActiveTab("caregiver")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "caregiver"
                ? "bg-[#FFB84C] text-[#0B0E11] shadow"
                : "text-[#8E9CAE] hover:text-[#F5F5F5]"
            }`}
          >
            <span>Caregiver Mirror</span>
          </button>
        </nav>

        {/* TAB 1: LIVE SIGHT COMPANION VIEW */}
        {activeTab === "live" && (
          <div className="flex flex-col items-center gap-6">
            {/* Primary Listening Pulsing Ring */}
            <ListeningIndicator
              isListening={isListening}
              activeTier={activeNarration?.tier}
              hasAudioActivity={audioActive}
              onToggle={() => {
                const next = !isListening;
                setIsListening(next);
                speakText(next ? "Sight companion started." : "Sight companion paused.");
              }}
            />

            {/* High-Visibility Active Narration Display */}
            <div
              className={`w-full max-w-xl rounded-2xl border-2 p-5 flex flex-col gap-2.5 shadow-xl transition-all ${
                activeNarration?.tier === "hazard"
                  ? "bg-[#FF4D4D]/10 border-[#FF4D4D]"
                  : activeNarration?.tier === "social"
                  ? "bg-[#38BDF8]/10 border-[#38BDF8]"
                  : "bg-[#14181D] border-[#232A32]"
              }`}
              role="region"
              aria-live={activeNarration?.tier === "hazard" ? "assertive" : "polite"}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getTierColor(
                    activeNarration?.tier
                  )}`}
                >
                  {activeNarration?.tier || "AMBIENT"} PRIORITY
                </span>
                <span className="text-[11px] font-mono text-[#8E9CAE]">
                  {activeNarration ? new Date(activeNarration.timestamp).toLocaleTimeString() : "--:--:--"}
                </span>
              </div>

              {/* Spoken Text Highlight */}
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F5F5] leading-snug">
                "{activeNarration?.text || "Listening for hazards and surroundings..."}"
              </p>

              {activeNarration?.detectedObjects && activeNarration.detectedObjects.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <span className="text-[11px] text-[#8E9CAE]">Objects:</span>
                  {activeNarration.detectedObjects.map((obj, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono bg-[#0B0E11] px-2 py-0.5 rounded border border-[#232A32] text-[#E0E6ED]"
                    >
                      {obj}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Video / Camera Capture & Scene Simulator */}
            <NarrationStreamHandler
              isListening={isListening}
              settings={settings}
              onNarrationReceived={handleNarrationReceived}
              onAudioActivity={setAudioActive}
              onStatusChange={setSystemStatus}
              userCoords={userCoords}
            />

            {/* Recent Narration History Log */}
            {narrationHistory.length > 0 && (
              <div className="w-full max-w-xl bg-[#14181D] border border-[#232A32] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-[#232A32] pb-2 text-xs text-[#8E9CAE]">
                  <span className="font-bold text-[#FFB84C] uppercase tracking-wider">Recent Audio Narration</span>
                  <span>{narrationHistory.length} events</span>
                </div>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {narrationHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => speakText(item.text)}
                      className="flex items-start justify-between gap-3 text-xs p-2 rounded-lg bg-[#0B0E11] hover:bg-[#232A32]/40 transition-colors cursor-pointer border border-[#232A32]"
                      role="button"
                      tabIndex={0}
                      aria-label={`Replay narration: ${item.text}`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                            item.tier === "hazard"
                              ? "bg-[#FF4D4D]"
                              : item.tier === "social"
                              ? "bg-[#38BDF8]"
                              : "bg-emerald-400"
                          }`}
                        />
                        <span className="text-[#F5F5F5] leading-relaxed">{item.text}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#8E9CAE] shrink-0">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COMMUNITY HAZARD MESH */}
        {activeTab === "hazard-map" && (
          <HazardMapView userCoords={userCoords} onSpeakText={speakText} />
        )}

        {/* TAB 3: CAREGIVER MIRROR MODE */}
        {activeTab === "caregiver" && (
          <CaregiverMirrorView
            onSpeakText={speakText}
            incomingLog={
              activeNarration
                ? {
                    id: activeNarration.id,
                    timestamp: new Date(activeNarration.timestamp).toISOString(),
                    tier: activeNarration.tier,
                    text: activeNarration.text,
                    hapticPattern: activeNarration.hapticPattern,
                    lat: activeNarration.location?.lat,
                    lng: activeNarration.location?.lng,
                  }
                : null
            }
          />
        )}
      </main>

      {/* Accessible Persistent Footer */}
      <footer className="bg-[#0B0E11] border-t border-[#232A32] px-4 py-3 mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#8E9CAE]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isListening ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
              <span>Status: {systemStatus}</span>
            </span>
            <span>•</span>
            <span className="font-mono text-[#FFB84C]">
              {settings.priorityFilter === "hazards_only" ? "HAZARDS ONLY" : "FULL TRIAGE"}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <button
              onClick={() => setShowOnboarding(true)}
              className="hover:text-[#F5F5F5] underline"
            >
              Audio Guide
            </button>
            <button
              onClick={() => {
                speakText("Beacon sight companion active. All systems operational.");
              }}
              className="hover:text-[#FFB84C] font-semibold"
            >
              System Audio Ping
            </button>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onTestSpeech={speakText}
      />

      {/* Onboarding Guidance Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleCompleteOnboarding}
        onSpeak={speakText}
      />
    </div>
  );
}
