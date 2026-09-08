/**
 * Beacon — Real-Time AI Sight Companion
 * Narration Stream Handler
 * Owns getUserMedia camera capture, frame streaming, Web Speech TTS, haptics, and simulation fallback
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [rawErrorDetail, setRawErrorDetail] = useState<string | null>(null);
  const [activeSimulation, setActiveSimulation] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [lastSpeechText, setLastSpeechText] = useState<string>("");

  // Multi-device and lens state
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  // Detect iframe on mount
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  // Enumerate camera devices
  const enumerateCameras = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setAvailableDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (e) {
      console.warn("Could not enumerate camera devices:", e);
    }
  }, [selectedDeviceId]);

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

    // Initial check for camera devices
    enumerateCameras();

    return () => {
      socket.disconnect();
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsStartingCamera(false);
  }, []);

  // Resilient multi-tier camera initializer
  const startCamera = useCallback(
    async (overrideDeviceId?: string, overrideFacing?: "environment" | "user") => {
      setIsStartingCamera(true);
      setCameraError(null);
      setRawErrorDetail(null);

      // Stop existing stream if running
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // Check browser support
      if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isSecure = window.isSecureContext;
        const msg = !isSecure
          ? "Camera requires a secure HTTPS connection. Please load this page over HTTPS."
          : "Your browser does not expose mediaDevices or camera permissions are restricted by the host.";
        setCameraError(msg);
        setCameraActive(false);
        setIsStartingCamera(false);
        onStatusChange("Camera unavailable: mediaDevices not supported");
        return;
      }

      const targetMode = overrideFacing || facingMode;
      const targetDevId = overrideDeviceId !== undefined ? overrideDeviceId : selectedDeviceId;

      // Build progressive fallback constraint list
      const attempts: MediaStreamConstraints[] = [];

      // Attempt 1: Target specific device if selected
      if (targetDevId) {
        attempts.push({
          video: { deviceId: { exact: targetDevId } },
          audio: false,
        });
      }

      // Attempt 2: Preferred facing mode with standard HD resolution
      attempts.push({
        video: {
          facingMode: { ideal: targetMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      // Attempt 3: Preferred facing mode without resolution constraints
      attempts.push({
        video: {
          facingMode: targetMode,
        },
        audio: false,
      });

      // Attempt 4: Flip facing mode (user vs environment)
      attempts.push({
        video: {
          facingMode: targetMode === "environment" ? "user" : "environment",
        },
        audio: false,
      });

      // Attempt 5: Generic video fallback (any available camera device)
      attempts.push({
        video: true,
        audio: false,
      });

      let activeStream: MediaStream | null = null;
      let lastErr: any = null;

      for (const constraint of attempts) {
        try {
          activeStream = await navigator.mediaDevices.getUserMedia(constraint);
          if (activeStream) break;
        } catch (err: any) {
          lastErr = err;
          console.warn("Camera constraint attempt failed:", constraint, err);
        }
      }

      if (!activeStream) {
        console.error("All camera stream attempts failed. Last error:", lastErr);
        let userFriendlyMsg = "Unable to start camera.";
        const errName = lastErr?.name || "";
        const errMsg = lastErr?.message || "";

        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          userFriendlyMsg =
            "Camera permission was denied. Please allow camera access in your browser address bar or site permissions.";
        } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          userFriendlyMsg =
            "No camera device was detected on your system. You can use the Quick Test Scenarios or upload a snapshot.";
        } else if (errName === "NotReadableError" || errName === "TrackStartError") {
          userFriendlyMsg =
            "Camera is currently in use by another application (e.g., Zoom, Teams, or another tab). Please close other camera apps and retry.";
        } else if (errName === "OverconstrainedError") {
          userFriendlyMsg = "Camera does not support the requested resolution or lens.";
        } else if (errName === "SecurityError") {
          userFriendlyMsg =
            "Camera blocked by browser security policy or iframe constraints. Try opening Beacon in a standalone new tab.";
        } else if (errMsg) {
          userFriendlyMsg = `Camera error: ${errMsg}`;
        }

        setCameraError(userFriendlyMsg);
        setRawErrorDetail(errName ? `${errName}: ${errMsg}` : errMsg || null);
        setCameraActive(false);
        setIsStartingCamera(false);
        onStatusChange(`Camera error: ${errName || "unavailable"}`);
        return;
      }

      streamRef.current = activeStream;

      // Safely mount into video element
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = activeStream;
        video.muted = true;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");

        // Safe play handling
        video.onloadedmetadata = () => {
          video.play().catch((e) => console.warn("video.play() loadedmetadata notice:", e));
        };
        video.play().catch((e) => console.warn("video.play() direct notice:", e));
      }

      setCameraActive(true);
      setCameraError(null);
      setRawErrorDetail(null);
      setIsStartingCamera(false);
      onStatusChange("Camera stream active");

      // Update devices list now that permission is granted
      enumerateCameras();
    },
    [facingMode, selectedDeviceId, enumerateCameras, onStatusChange]
  );

  // Toggle between Front and Back camera lenses
  const toggleFacingMode = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(undefined, nextMode);
  };

  // Manage Camera and Frame Loop when listening status or interval changes
  useEffect(() => {
    if (isListening) {
      if (!cameraActive) {
        startCamera();
      }
      startFrameLoop();
    } else {
      stopFrameLoop();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }

    return () => {
      stopFrameLoop();
    };
  }, [isListening, settings.samplingIntervalMs, settings.offlineDegradedMode]);

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

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

    let base64Data = "";
    if (cameraActive && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = Math.min(640, video.videoWidth);
        canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          base64Data = canvas.toDataURL("image/jpeg", 0.7);
        }
      }
    }

    // If no webcam frame is available, generate a lightweight simulated visual placeholder
    if (!base64Data) {
      base64Data = createSimulatedFrame(activeSimulation);
    }

    sendImageFrame(base64Data, activeSimulation || undefined);
  };

  // Core frame dispatch over WebSocket or REST with offline fallback
  const sendImageFrame = async (base64Data: string, label?: string) => {
    onAudioActivity(true);
    setTimeout(() => onAudioActivity(false), 400);

    // If offline degraded mode is explicitly forced or offline
    if (settings.offlineDegradedMode || !socketConnected) {
      processOfflineFrame(label);
      return;
    }

    try {
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
      processOfflineFrame(label);
    }
  };

  // Direct snapshot handler from file input (native phone camera photo or image picker)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        onStatusChange(`Analyzing snapshot: ${file.name}`);
        sendImageFrame(base64, "Snapshot: " + file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Offline Heuristic Processing
  const processOfflineFrame = async (label?: string) => {
    const offlineProvider = new HeuristicVisionProvider();
    const triageInput = await offlineProvider.analyzeFrame(
      label || activeSimulation || "offline-sample",
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
        navigator.vibrate([250, 100, 250, 100, 500]);
      } else if (pattern === "hazard-approaching") {
        navigator.vibrate([150, 150, 150]);
      } else if (pattern === "social-cue") {
        navigator.vibrate([80, 80, 80]);
      }
    } catch (e) {}
  };

  // Web Speech API with Priority Hazard Interrupt
  const speakNarration = (text: string, isHazard: boolean) => {
    if (!window.speechSynthesis) return;

    if (isHazard) {
      window.speechSynthesis.cancel();
    } else if (window.speechSynthesis.speaking) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = isHazard ? Math.min(1.8, (settings.voiceSpeed || 1.1) * 1.1) : settings.voiceSpeed || 1.0;
    utterance.pitch = isHazard ? 1.1 : settings.voicePitch || 1.0;
    utterance.volume = settings.audioVolume || 1.0;

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) =>
        (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha")) &&
        v.lang.startsWith("en")
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
      {/* Hidden processing canvas and native photo capture input */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        id="camera-file-capture-input"
        onChange={handlePhotoUpload}
      />

      {/* Video Viewfinder / Camera Panel */}
      <div className="relative w-full max-w-md aspect-video bg-[#14181D] rounded-2xl overflow-hidden border border-[#232A32] shadow-xl flex items-center justify-center">
        {/* Real camera video - always in DOM, styled cleanly */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cameraActive ? "opacity-100 block" : "opacity-0 absolute pointer-events-none"
          }`}
        />

        {/* Camera Inactive / Error / Guidance Overlay */}
        {!cameraActive && (
          <div className="flex flex-col items-center justify-center text-center p-5 text-[#8E9CAE] z-10 w-full">
            <div className="w-12 h-12 rounded-full border border-[#FFB84C]/40 flex items-center justify-center mb-2.5 text-[#FFB84C] bg-[#FFB84C]/10">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
              </svg>
            </div>

            <p className="text-sm font-bold text-[#F5F5F5]">Camera Standby</p>

            {/* Error diagnosis or instructions */}
            <p className="text-xs text-[#8E9CAE] mt-1 max-w-xs leading-relaxed">
              {cameraError || "Tap 'Enable Camera' to activate live video sight, or snap a photo."}
            </p>

            {rawErrorDetail && (
              <p className="text-[10px] font-mono text-amber-400/90 bg-[#0B0E11] px-2 py-1 rounded mt-1.5 border border-[#232A32] max-w-xs break-words">
                {rawErrorDetail}
              </p>
            )}

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <button
                id="enable-camera-btn"
                onClick={() => startCamera()}
                disabled={isStartingCamera}
                className="px-4 py-2 bg-[#FFB84C] text-[#0B0E11] text-xs font-bold rounded-full hover:bg-[#ffa726] transition-colors shadow disabled:opacity-50 flex items-center gap-1.5"
              >
                {isStartingCamera ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-[#0B0E11] border-t-transparent animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                      <path d="M9 2L7.17 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.17L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10z" />
                    </svg>
                    Enable Live Camera
                  </>
                )}
              </button>

              <button
                id="snap-photo-trigger-btn"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 bg-[#1C2229] border border-[#232A32] text-[#F5F5F5] text-xs font-medium rounded-full hover:bg-[#232A32] transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 fill-current text-[#FFB84C]" viewBox="0 0 24 24">
                  <path d="M4 4h3l2-2h6l2 2h3a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2m8 3a5 5 0 100 10 5 5 0 000-10z" />
                </svg>
                Snap Photo
              </button>

              {/* Standalone new tab link for iframe security environments */}
              {isInIframe && (
                <a
                  id="open-standalone-tab-link"
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#0B0E11] border border-[#FFB84C]/50 text-[#FFB84C] text-[11px] font-semibold rounded-full hover:bg-[#FFB84C]/10 transition-colors flex items-center gap-1 mt-1"
                  title="If camera permissions are blocked inside preview iframe, open in a new browser tab"
                >
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                  </svg>
                  Open in New Tab
                </a>
              )}
            </div>
          </div>
        )}

        {/* Live HUD Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono pointer-events-none z-20">
          <div className="flex items-center gap-2 bg-[#0B0E11]/85 backdrop-blur px-2.5 py-1 rounded-full border border-[#232A32]">
            <span
              className={`w-2 h-2 rounded-full ${
                isListening ? "bg-[#FFB84C] animate-ping" : cameraActive ? "bg-emerald-400" : "bg-zinc-600"
              }`}
            />
            <span className="text-[#F5F5F5] font-semibold">
              {isListening ? "SCANNING" : cameraActive ? "CAMERA READY" : "STANDBY"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0B0E11]/85 backdrop-blur px-2.5 py-1 rounded-full border border-[#232A32] text-[#8E9CAE]">
            <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
            <span>{socketConnected ? "SERVER WS" : "OFFLINE ENGINE"}</span>
          </div>
        </div>

        {/* Camera Active Controls Bar */}
        {cameraActive && (
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between z-20">
            <div className="flex items-center gap-1.5 bg-[#0B0E11]/85 backdrop-blur px-2 py-1 rounded-lg border border-[#232A32]">
              <span className="text-[10px] text-[#8E9CAE] font-mono uppercase">
                {facingMode === "environment" ? "Back Lens" : "Front Lens"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                id="toggle-lens-btn"
                onClick={toggleFacingMode}
                className="p-1.5 bg-[#0B0E11]/90 hover:bg-[#232A32] text-[#FFB84C] border border-[#232A32] rounded-lg transition-colors text-xs flex items-center gap-1"
                title="Switch between front and back camera"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M9 12c0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3-3 1.34-3 3zm11-6h-3.17L15 4H9L7.17 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
                </svg>
                <span className="text-[10px] font-bold">Flip</span>
              </button>

              <button
                id="stop-camera-btn"
                onClick={stopCamera}
                className="p-1.5 bg-[#0B0E11]/90 hover:bg-red-950/50 text-red-400 border border-red-900/40 rounded-lg transition-colors text-xs flex items-center gap-1"
                title="Pause camera video feed"
              >
                <span className="text-[10px] font-bold">Stop Cam</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Multi-Camera Device Selector (Visible if user has multiple camera devices connected) */}
      {availableDevices.length > 1 && (
        <div className="w-full max-w-md flex items-center gap-2 px-1 text-xs text-[#8E9CAE]">
          <span className="whitespace-nowrap font-medium text-[11px]">Camera:</span>
          <select
            id="camera-device-select"
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              startCamera(e.target.value);
            }}
            className="flex-1 bg-[#14181D] border border-[#232A32] text-[#F5F5F5] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#FFB84C]"
          >
            {availableDevices.map((dev, idx) => (
              <option key={dev.deviceId || idx} value={dev.deviceId}>
                {dev.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Interactive Quick Scene Simulator (For verification and offline testing) */}
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

