/**
 * Beacon — Real-Time AI Sight Companion
 * Listening Indicator Component
 * Subtle pulsing ring synced with listening state, audio activity, and triage status
 */

import React from "react";
import { NarrationTier } from "../types.ts";

interface Props {
  isListening: boolean;
  activeTier?: NarrationTier;
  hasAudioActivity?: boolean;
  onToggle: () => void;
}

export const ListeningIndicator: React.FC<Props> = ({
  isListening,
  activeTier,
  hasAudioActivity,
  onToggle,
}) => {
  // Color configuration depending on current triage status
  const getRingColor = () => {
    if (!isListening) return "border-[#232A32] text-[#8E9CAE]";
    if (activeTier === "hazard") return "border-[#FF4D4D] text-[#FF4D4D]";
    if (activeTier === "social") return "border-[#38BDF8] text-[#38BDF8]";
    return "border-[#FFB84C] text-[#FFB84C]";
  };

  const getGlowBg = () => {
    if (!isListening) return "bg-[#14181D]";
    if (activeTier === "hazard") return "bg-[#FF4D4D]/20";
    if (activeTier === "social") return "bg-[#38BDF8]/20";
    return "bg-[#FFB84C]/15";
  };

  return (
    <div className="flex flex-col items-center justify-center select-none" id="listening-indicator-container">
      <button
        id="listening-toggle-btn"
        onClick={onToggle}
        aria-label={isListening ? "Pause Beacon sight companion" : "Start Beacon sight companion"}
        className="relative group focus:outline-none focus:ring-4 focus:ring-[#FFB84C] rounded-full p-4 transition-transform active:scale-95"
      >
        {/* Outer Pulsing Wave Ring (Active when listening) */}
        {isListening && (
          <>
            <span
              className={`absolute inset-0 rounded-full animate-ping opacity-25 ${
                activeTier === "hazard" ? "bg-[#FF4D4D]" : "bg-[#FFB84C]"
              }`}
              style={{ animationDuration: activeTier === "hazard" ? "1s" : "2.5s" }}
            />
            <span
              className={`absolute -inset-3 rounded-full border-2 border-dashed opacity-40 animate-spin ${getRingColor()}`}
              style={{ animationDuration: "14s" }}
            />
          </>
        )}

        {/* Central Core Button */}
        <div
          className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-300 shadow-2xl ${getRingColor()} ${getGlowBg()}`}
        >
          {isListening ? (
            <div className="flex flex-col items-center text-center px-2">
              {/* Audio waveform pulses */}
              <div className="flex items-center gap-1.5 h-6 mb-2">
                <span
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    hasAudioActivity ? "h-6 bg-current animate-pulse" : "h-2 bg-current/60"
                  }`}
                />
                <span
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    hasAudioActivity ? "h-8 bg-current" : "h-4 bg-current/60"
                  }`}
                />
                <span
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    hasAudioActivity ? "h-5 bg-current animate-pulse" : "h-2 bg-current/60"
                  }`}
                />
              </div>
              <span className="text-sm font-bold tracking-wider uppercase">
                {activeTier === "hazard" ? "HAZARD" : activeTier === "social" ? "SOCIAL" : "LISTENING"}
              </span>
              <span className="text-[11px] opacity-75 mt-0.5">Tap to Pause</span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <svg className="w-10 h-10 mb-1 fill-current opacity-80" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-sm font-bold tracking-wider uppercase">STANDBY</span>
              <span className="text-[11px] opacity-75 mt-0.5">Tap to Start</span>
            </div>
          )}
        </div>
      </button>

      {/* Screen reader live narration announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {isListening
          ? `Beacon is actively scanning surroundings. Current status: ${activeTier || "ambient monitoring"}`
          : "Beacon is paused."}
      </div>
    </div>
  );
};
