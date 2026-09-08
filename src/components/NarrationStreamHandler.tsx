/**
 * Beacon — Real-Time AI Sight Companion
 * Narration Stream Handler
 * Owns getUserMedia camera capture, frame streaming, Web Speech TTS, haptics, and simulation fallback
 */

import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { HapticPattern, NarrationTier, TriageOutput, UserSettings } from "../types.ts";
import { TriageEngine } from "../../services/triage.service.ts";
import { HeuristicVisionProvider } from "../../services/vision.service.ts";

interface Props {
  isListening: boolean;
  settings: UserSettings;
  onNarrationReceived: (output: TriageOutput) => void;
  onAudioActivity: (active: boolean) => void;
  onStatusChange: (status: string) => void;
  userCoords?: { lat: number; lng: number } | null;
}

export const NarrationStreamHandler: React.FC<Props> = ({
  isListening,
  settings,
  onNarrationReceived,
  onAudioActivity,
  onStatusChange,
  userCoords,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeSimulation, setActiveSimulation] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [lastSpeechText, setLastSpeechText] = useState<string>("");

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io({
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      setSocketConnected(true);
      onStatusChange("Connected to Beacon Real-Time Engine");
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      onStatusChange("Offline / Degraded Mode Active");
    });

    socket.on("narration:receive", (output: TriageOutput) => {
      handleIncomingNarration(output);
    });

    socket.on("narration:error", (err: any) => {
      console.warn("Socket narration error:", err);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  // Manage Camera stream when listening is toggled
  useEffect(() => {
    if (isListening) {
      startCamera();
      startFrameLoop();
    } else {
      stopFrameLoop();
      // Keep camera warm or release
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }

    return () => {
      stopFrameLoop();
    };
  }, [isListening, cameraActive, settings.offlineDegradedMode]);

  const startCamera = async () => {
    if (cameraActive && streamRef.current) return;
    try {
      setCameraError(null);
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false, // audio capture via speech / audioContext if needed
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      onStatusChange("Camera stream active");
    } catch (err: any) {
      console.warn("Camera permission denied or camera unavailable:", err);
      setCameraError("Camera unavailable — simulation test mode active.");
      setCameraActive(false);
      onStatusChange("Simulation mode active (Camera unavailable)");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startFrameLoop = () => {
    stopFrameLoop();
    const intervalTime = Math.max(1200, settings.samplingIntervalMs || 1800);

    intervalRef.current = setInterval(() => {
      captureAndProcess();
    }, intervalTime);
  };

  const stopFrameLoop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Capture frame from webcam canvas or generate test scene
  const captureAndProcess = async () => {
    if (!isListening) return;

    onAudioActivity(true);
    setTimeout(() => onAudioActivity(false), 400);

    // If offline degraded mode is explicitly forced or offline
    if (settings.offlineDegradedMode || !socketConnected) {
      processOfflineFrame();
      return;
    }

    try {
      let base64Data = "";
      if (cameraActive && videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = 480;
        canvas.height = 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          base64Data = canvas.toDataURL("image/jpeg", 0.7);
        }
      }

      // If no webcam frame is available, generate a lightweight simulated visual placeholder
      if (!base64Data) {
        base64Data = createSimulatedFrame(activeSimulation);
      }

      // Send over socket if available
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("frame:send", {
          image: base64Data,
          lat: userCoords?.lat ?? 37.7749,
          lng: userCoords?.lng ?? -122.4194,
        });
      } else {
        // Fallback to HTTP REST endpoint
        const res = await fetch("/api/vision/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Data,
            lat: userCoords?.lat,
            lng: userCoords?.lng,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.output) {
            handleIncomingNarration(data.output);
          }
        }
      }
    } catch (err) {
      console.warn("Frame capture error:", err);
      processOfflineFrame();
    }
  };

  // Offline Heuristic Processing
  const processOfflineFrame = async () => {
    const offlineProvider = new HeuristicVisionProvider();
    const triageInput = await offlineProvider.analyzeFrame(
      activeSimulation || "offline-sample",
      userCoords || undefined
    );
    const output = TriageEngine.triage(triageInput, userCoords || undefined);
    handleIncomingNarration(output);
  };

  // Generate lightweight synthetic base64 JPEG for browser test simulation
  const createSimulatedFrame = (label: string | null): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.fillStyle = "#14181D";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#FFB84C";
    ctx.font = "16px sans-serif";
    ctx.fillText(label || "Beacon Sight Snapshot", 20, 120);
    return canvas.toDataURL("image/jpeg", 0.6);
  };

  // Handle incoming triaged narration: filter, speak via TTS, trigger haptics
  const handleIncomingNarration = (output: TriageOutput) => {
    // Respect user priority filter
    if (settings.priorityFilter === "hazards_only" && output.tier !== "hazard") {
      return;
    }
    if (settings.priorityFilter === "hazards_and_social" && output.tier === "ambient") {
      return;
    }

    onNarrationReceived(output);

    // 1. Trigger Haptic Pattern
    if (settings.hapticsEnabled && output.hapticPattern) {
      triggerHaptics(output.hapticPattern);
    }

    // 2. Audio Speech Synthesis
    if (settings.speechEnabled) {
      speakNarration(output.text, output.tier === "hazard");
    }
  };

  // Distinct Vibration Patterns
  const triggerHaptics = (pattern: HapticPattern) => {
    if (!("vibrate" in navigator)) return;

    try {
      if (pattern === "hazard-near") {
        // [250ms pulse, 100ms pause, 250ms pulse, 100ms pause, 500ms firm buzz]
        navigator.vibrate([250, 100, 250, 100, 500]);
      } else if (pattern === "hazard-approaching") {
        // [150ms, 150ms, 150ms]
        navigator.vibrate([150, 150, 150]);
      } else if (pattern === "social-cue") {
        // [80ms, 80ms, 80ms]
        navigator.vibrate([80, 80, 80]);
      }
    } catch (e) {
      // Haptic may be disabled by system
    }
  };

  // Web Speech API with Priority Hazard Interrupt
  const speakNarration = (text: string, isHazard: boolean) => {
    if (!window.speechSynthesis) return;

    // Critical: If immediate physical hazard, cancel any in-flight ambient speech instantly!
    if (isHazard) {
      window.speechSynthesis.cancel();
    } else if (window.speechSynthesis.speaking) {
      // Do not talk over other non-hazard speech
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = isHazard ? Math.min(1.8, (settings.voiceSpeed || 1.1) * 1.1) : settings.voiceSpeed || 1.0;
    utterance.pitch = isHazard ? 1.1 : settings.voicePitch || 1.0;
    utterance.volume = settings.audioVolume || 1.0;

    // Pick crisp English voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) => (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha")) && v.lang.startsWith("en")
    );
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    setLastSpeechText(text);
    window.speechSynthesis.speak(utterance);
  };

  // Scenario Simulator Picker
  const triggerSimulation = (scenarioName: string) => {
    setActiveSimulation(scenarioName);
    captureAndProcess();
  };

  return (
    <div className="w-full flex flex-col items-center gap-4" id="narration-stream-handler">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video Viewfinder / Status Panel */}
      <div className="relative w-full max-w-md aspect-video bg-[#14181D] rounded-2xl overflow-hidden border border-[#232A32] shadow-xl flex items-center justify-center">
        {/* Real camera video */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
        />

        {/* Fallback Viewfinder Overlay */}
        {!cameraActive && (
          <div className="flex flex-col items-center justify-center text-center p-6 text-[#8E9CAE]">
            <div className="w-12 h-12 rounded-full border border-[#FFB84C]/40 flex items-center justify-center mb-3 text-[#FFB84C]">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-[#F5F5F5]">Virtual Sensor Stream</p>
            <p className="text-xs text-[#8E9CAE] mt-1 max-w-xs">
              {cameraError || "Camera standby. Tap test scenarios below or enable live camera."}
            </p>
            <button
              id="enable-camera-btn"
              onClick={startCamera}
              className="mt-3 px-4 py-2 bg-[#FFB84C] text-[#0B0E11] text-xs font-bold rounded-full hover:bg-[#ffa726] transition-colors"
            >
              Request Camera Access
            </button>
          </div>
        )}

        {/* Live HUD Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono pointer-events-none">
          <div className="flex items-center gap-2 bg-[#0B0E11]/85 backdrop-blur px-2.5 py-1 rounded-full border border-[#232A32]">
            <span className={`w-2 h-2 rounded-full ${isListening ? "bg-[#FFB84C] animate-ping" : "bg-zinc-600"}`} />
            <span className="text-[#F5F5F5] font-semibold">{isListening ? "SCANNING 1.5s" : "PAUSED"}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0B0E11]/85 backdrop-blur px-2.5 py-1 rounded-full border border-[#232A32] text-[#8E9CAE]">
            <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
            <span>{socketConnected ? "SERVER WS" : "OFFLINE ENGINE"}</span>
          </div>
        </div>
      </div>

      {/* Interactive Quick Scene Simulator (Crucial for test verification on all devices) */}
      <div className="w-full max-w-md bg-[#14181D] border border-[#232A32] rounded-xl p-3" id="quick-scenario-tester">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold tracking-wider text-[#FFB84C] uppercase">Test Scene Trigger</span>
          <span className="text-[11px] text-[#8E9CAE]">Simulate surroundings</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            id="sim-stairs-btn"
            onClick={() => triggerSimulation("stairs_down")}
            className="px-2.5 py-2 rounded-lg bg-[#0B0E11] border border-[#FF4D4D]/50 hover:bg-[#FF4D4D]/10 text-left text-xs text-[#F5F5F5] transition-colors"
          >
            <span className="block font-bold text-[#FF4D4D]">⚠️ Stairs Ahead</span>
            <span className="text-[10px] text-[#8E9CAE]">Drop hazard</span>
          </button>
          <button
            id="sim-curb-btn"
            onClick={() => triggerSimulation("curb")}
            className="px-2.5 py-2 rounded-lg bg-[#0B0E11] border border-[#FFB84C]/50 hover:bg-[#FFB84C]/10 text-left text-xs text-[#F5F5F5] transition-colors"
          >
            <span className="block font-bold text-[#FFB84C]">🚧 Street Curb</span>
            <span className="text-[10px] text-[#8E9CAE]">Step-down warning</span>
          </button>
          <button
            id="sim-cyclist-btn"
            onClick={() => triggerSimulation("cyclist")}
            className="px-2.5 py-2 rounded-lg bg-[#0B0E11] border border-[#FF4D4D]/50 hover:bg-[#FF4D4D]/10 text-left text-xs text-[#F5F5F5] transition-colors"
          >
            <span className="block font-bold text-[#FF4D4D]">🚲 Oncoming Bike</span>
            <span className="text-[10px] text-[#8E9CAE]">Dynamic obstacle</span>
          </button>
          <button
            id="sim-friend-btn"
            onClick={() => triggerSimulation("friend_waving")}
            className="px-2.5 py-2 rounded-lg bg-[#0B0E11] border border-[#38BDF8]/50 hover:bg-[#38BDF8]/10 text-left text-xs text-[#F5F5F5] transition-colors"
          >
            <span className="block font-bold text-[#38BDF8]">👋 Friend Waving</span>
            <span className="text-[10px] text-[#8E9CAE]">Social context</span>
          </button>
          <button
            id="sim-wetfloor-btn"
            onClick={() => triggerSimulation("wet_floor")}
            className="px-2.5 py-2 rounded-lg bg-[#0B0E11] border border-[#FFB84C]/50 hover:bg-[#FFB84C]/10 text-left text-xs text-[#F5F5F5] transition-colors"
          >
            <span className="block font-bold text-[#FFB84C]">💧 Wet Floor</span>
            <span className="text-[10px] text-[#8E9CAE]">Slippery sign</span>
          </button>
          <button
            id="sim-clearpath-btn"
            onClick={() => triggerSimulation("clear_path")}
            className="px-2.5 py-2 rounded-lg bg-[#0B0E11] border border-emerald-500/50 hover:bg-emerald-500/10 text-left text-xs text-[#F5F5F5] transition-colors"
          >
            <span className="block font-bold text-emerald-400">✅ Clear Sidewalk</span>
            <span className="text-[10px] text-[#8E9CAE]">Ambient stable</span>
          </button>
        </div>
      </div>
    </div>
  );
};
