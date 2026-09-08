/**
 * Beacon — Real-Time AI Sight Companion
 * Settings & Accessibility Configuration Modal
 */

import React from "react";
import { UserSettings } from "../types.ts";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onTestSpeech: (text: string) => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onTestSpeech,
}) => {
  if (!isOpen) return null;

  const testHaptic = (pattern: "hazard-near" | "hazard-approaching" | "social-cue") => {
    if (!("vibrate" in navigator)) {
      onTestSpeech("Haptic feedback not supported on this browser or platform.");
      return;
    }
    if (pattern === "hazard-near") {
      navigator.vibrate([250, 100, 250, 100, 500]);
      onTestSpeech("Vibration test: hazard near. Double pulse followed by firm buzz.");
    } else if (pattern === "hazard-approaching") {
      navigator.vibrate([150, 150, 150]);
      onTestSpeech("Vibration test: hazard approaching. Triple pulse.");
    } else {
      navigator.vibrate([80, 80, 80]);
      onTestSpeech("Vibration test: social cue tap.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="bg-[#14181D] border-2 border-[#232A32] rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232A32] pb-3">
          <div>
            <h2 id="settings-title" className="text-lg font-bold text-[#F5F5F5]">
              Accessibility & Voice Settings
            </h2>
            <p className="text-xs text-[#8E9CAE]">Fine-tune audio cadence, triage filter, and haptic pulses</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl font-bold text-[#8E9CAE] hover:text-[#F5F5F5] p-2 focus:ring-2 focus:ring-[#FFB84C] rounded-lg"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* 1. High Contrast Mode Toggle */}
        <div className="flex items-center justify-between p-3 bg-[#0B0E11] rounded-xl border border-[#232A32]">
          <div>
            <span className="text-sm font-bold text-[#F5F5F5] block">Ultra-High Contrast Theme</span>
            <span className="text-xs text-[#8E9CAE]">Maximum luminance contrast for low-vision eyes</span>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ highContrast: !settings.highContrast })}
            className={`w-14 h-8 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-[#FFB84C] ${
              settings.highContrast ? "bg-[#FFE600]" : "bg-zinc-700"
            }`}
          >
            <span
              className={`block w-6 h-6 rounded-full bg-black transition-transform ${
                settings.highContrast ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* 2. Priority Filter */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-[#FFB84C] uppercase tracking-wider">
            Triage Priority Filter
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              onClick={() => onUpdateSettings({ priorityFilter: "all" })}
              className={`py-2 px-2 rounded-lg font-bold border transition-colors ${
                settings.priorityFilter === "all"
                  ? "bg-[#FFB84C] text-[#0B0E11] border-[#FFB84C]"
                  : "bg-[#0B0E11] text-[#8E9CAE] border-[#232A32]"
              }`}
            >
              All Context
            </button>
            <button
              onClick={() => onUpdateSettings({ priorityFilter: "hazards_and_social" })}
              className={`py-2 px-2 rounded-lg font-bold border transition-colors ${
                settings.priorityFilter === "hazards_and_social"
                  ? "bg-[#FFB84C] text-[#0B0E11] border-[#FFB84C]"
                  : "bg-[#0B0E11] text-[#8E9CAE] border-[#232A32]"
              }`}
            >
              Hazards + Social
            </button>
            <button
              onClick={() => onUpdateSettings({ priorityFilter: "hazards_only" })}
              className={`py-2 px-2 rounded-lg font-bold border transition-colors ${
                settings.priorityFilter === "hazards_only"
                  ? "bg-[#FF4D4D] text-[#0B0E11] border-[#FF4D4D]"
                  : "bg-[#0B0E11] text-[#8E9CAE] border-[#232A32]"
              }`}
            >
              Hazards Only
            </button>
          </div>
          <span className="text-[11px] text-[#8E9CAE]">
            {settings.priorityFilter === "hazards_only"
              ? "Silences ambient scene details; only alarms for physical steps, drop-offs, and obstacles."
              : "Narrates urgent physical warnings first, followed by nearby people and ambient context."}
          </span>
        </div>

        {/* 3. Voice Cadence Speed Slider */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#FFB84C] uppercase tracking-wider">
              Narration Speed: {settings.voiceSpeed.toFixed(1)}x
            </label>
            <button
              onClick={() => onTestSpeech(`Beacon voice test at ${settings.voiceSpeed.toFixed(1)} times speed.`)}
              className="text-xs text-[#FFB84C] hover:underline font-bold"
            >
              Test Voice
            </button>
          </div>
          <input
            type="range"
            min="0.8"
            max="1.8"
            step="0.1"
            value={settings.voiceSpeed}
            onChange={(e) => onUpdateSettings({ voiceSpeed: parseFloat(e.target.value) })}
            className="w-full accent-[#FFB84C] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#8E9CAE] font-mono">
            <span>0.8x (Deliberate)</span>
            <span>1.1x (Default)</span>
            <span>1.8x (Fast Scan)</span>
          </div>
        </div>

        {/* 4. Haptic Feedback Tester */}
        <div className="flex flex-col gap-2 border-t border-[#232A32] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#FFB84C] uppercase tracking-wider">
              Vibration Cues (Haptics)
            </span>
            <label className="flex items-center gap-2 text-xs text-[#F5F5F5] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.hapticsEnabled}
                onChange={(e) => onUpdateSettings({ hapticsEnabled: e.target.checked })}
                className="accent-[#FFB84C] w-4 h-4 rounded"
              />
              <span>Enabled</span>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-1">
            <button
              type="button"
              onClick={() => testHaptic("hazard-near")}
              className="py-2 px-2 bg-[#0B0E11] border border-[#FF4D4D]/50 hover:bg-[#FF4D4D]/20 rounded-lg text-xs font-bold text-[#FF4D4D] text-center"
            >
              Hazard Near
            </button>
            <button
              type="button"
              onClick={() => testHaptic("hazard-approaching")}
              className="py-2 px-2 bg-[#0B0E11] border border-[#FFB84C]/50 hover:bg-[#FFB84C]/20 rounded-lg text-xs font-bold text-[#FFB84C] text-center"
            >
              Approaching
            </button>
            <button
              type="button"
              onClick={() => testHaptic("social-cue")}
              className="py-2 px-2 bg-[#0B0E11] border border-[#38BDF8]/50 hover:bg-[#38BDF8]/20 rounded-lg text-xs font-bold text-[#38BDF8] text-center"
            >
              Social Tap
            </button>
          </div>
        </div>

        {/* 5. Offline Degraded Mode Switch */}
        <div className="flex items-center justify-between p-3 bg-[#0B0E11] rounded-xl border border-[#232A32]">
          <div>
            <span className="text-sm font-bold text-[#F5F5F5] block">Force Offline Degraded Mode</span>
            <span className="text-xs text-[#8E9CAE]">Simulates losing cellular connection mid-street</span>
          </div>
          <input
            type="checkbox"
            checked={settings.offlineDegradedMode}
            onChange={(e) => onUpdateSettings({ offlineDegradedMode: e.target.checked })}
            className="accent-[#FFB84C] w-5 h-5 rounded cursor-pointer"
          />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-[#FFB84C] text-[#0B0E11] font-bold text-sm rounded-xl hover:bg-[#ffa726] transition-colors mt-2"
        >
          Save & Return to Sight Companion
        </button>
      </div>
    </div>
  );
};
