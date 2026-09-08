/**
 * Beacon — Real-Time AI Sight Companion
 * Onboarding & Permissions Guide
 */

import React from "react";

interface Props {
  isOpen: boolean;
  onComplete: () => void;
  onSpeak: (text: string) => void;
}

export const OnboardingModal: React.FC<Props> = ({ isOpen, onComplete, onSpeak }) => {
  if (!isOpen) return null;

  const playAudioTour = () => {
    onSpeak(
      "Welcome to Beacon. An audio-first sight companion. Beacon continuously streams your surroundings to a triage engine, warning you about physical hazards first, then people and ambient cues. No screen interaction required. Tap anywhere to start."
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0E11]/95 backdrop-blur-lg flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#14181D] border-2 border-[#FFB84C] rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#FFB84C]/20 border-2 border-[#FFB84C] text-[#FFB84C] flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#F5F5F5]">Welcome to Beacon</h1>
          <p className="text-xs text-[#8E9CAE] mt-1">
            Audio-first real-time AI sight companion designed for blind and low-vision independence.
          </p>
        </div>

        <div className="flex flex-col gap-3 text-xs text-[#E0E6ED] bg-[#0B0E11] p-4 rounded-xl border border-[#232A32]">
          <div className="flex items-start gap-2.5">
            <span className="text-[#FF4D4D] font-bold text-sm">1.</span>
            <p>
              <strong className="text-[#F5F5F5]">Physical Hazard Priority:</strong> Curbs, drop-offs, stairs, vehicles, and wet floors always interrupt other speech.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-[#38BDF8] font-bold text-sm">2.</span>
            <p>
              <strong className="text-[#F5F5F5]">Social Context:</strong> Friends waving, approaching pedestrians, and open doors are voiced next.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-[#FFB84C] font-bold text-sm">3.</span>
            <p>
              <strong className="text-[#F5F5F5]">Community Hazard Mesh:</strong> Your travels silently discover and warn others of sidewalk obstacles in real time.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={playAudioTour}
            className="w-full py-2.5 bg-[#232A32] text-[#F5F5F5] font-semibold text-xs rounded-xl hover:bg-[#2c353f] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 fill-current text-[#FFB84C]" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
            Play Voice Introduction
          </button>

          <button
            onClick={onComplete}
            className="w-full py-3.5 bg-[#FFB84C] text-[#0B0E11] font-bold text-sm rounded-xl hover:bg-[#ffa726] transition-colors focus:ring-4 focus:ring-white"
          >
            Enter Sight Companion
          </button>
        </div>
      </div>
    </div>
  );
};
