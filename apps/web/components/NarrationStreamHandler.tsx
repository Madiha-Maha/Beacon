"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import type { TriageOutput } from "@beacon/shared/types";
import { useAppStore } from "@/lib/store";

const HAPTIC_PATTERNS: Record<NonNullable<TriageOutput["hapticPattern"]>, number | number[]> = {
  "hazard-near": [80, 40, 80],
  "hazard-approaching": [40, 60, 40, 60, 40],
  "social-cue": [30, 50, 30],
};

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  onNarration?: (out: TriageOutput) => void;
  onError?: (msg: string) => void;
}

function triggerHaptic(pattern?: TriageOutput["hapticPattern"], enabled = true) {
  if (!enabled || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (!pattern) return;
  try {
    navigator.vibrate(HAPTIC_PATTERNS[pattern]);
  } catch {
    // ignore haptic failures
  }
}

export default function NarrationStreamHandler({
  videoRef,
  onNarration,
  onError,
}: Props) {
  const socketRef = useRef<Socket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameAtRef = useRef<number>(0);
  const geolocationWatchRef = useRef<number | null>(null);
  const lastKnownGeoRef = useRef<{ lat: number; lng: number } | null>(null);

  const store = useAppStore;
  const settings = useAppStore((s) => s.settings);
  const setListeningState = useAppStore((s) => s.setListeningState);
  const setLastError = useAppStore((s) => s.setLastError);
  const listeningState = useAppStore((s) => s.listeningState);
  const accessToken = useAppStore((s) => s.accessToken);
  const userId = useAppStore((s) => s.userId);

  const speak = useCallback(
    (text: string, tier: TriageOutput["tier"]) => {
      const s = store.getState().settings;
      if (!s.ttsEnabled) return;
      if (tier === "ambient" && !s.ambientNarration) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      try {
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = s.voiceRate;
        utter.pitch = s.voicePitch;
        utter.volume = 1;

        const voices = window.speechSynthesis.getVoices();
        if (s.selectedVoiceUri) {
          const v = voices.find((x) => x.voiceURI === s.selectedVoiceUri);
          if (v) utter.voice = v;
        } else {
          const english = voices.find(
            (v) => /^en/i.test(v.lang) && (v.localService || v.default)
          );
          if (english) utter.voice = english;
        }

        if (tier === "hazard") {
          utter.rate = Math.min(utter.rate * 1.1, 1.8);
          utter.pitch = Math.min(utter.pitch * 1.05, 1.5);
        }

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      } catch (e) {
        console.warn("TTS failed", e);
      }
    },
    [store]
  );

  const stopEverything = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (geolocationWatchRef.current != null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(geolocationWatchRef.current);
      geolocationWatchRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [videoRef]);

  const startCapture = useCallback(async () => {
    stopEverything();
    setListeningState("requesting");

    try {
      if (typeof navigator === "undefined") {
        throw new Error("Browser APIs unavailable");
      }

      if ("geolocation" in navigator) {
        try {
          geolocationWatchRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              lastKnownGeoRef.current = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              };
            },
            () => {
              lastKnownGeoRef.current = null;
            },
            { enableHighAccuracy: false, maximumAge: 5000, timeout: 8000 }
          );
        } catch {
          // optional, ignore
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: { ideal: 15 },
        },
      });
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // autoplay might be blocked; ignore
        }
      }

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";
      const socket = io(wsUrl, {
        transports: ["websocket"],
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 600,
        reconnectionDelayMax: 4000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        if (userId || accessToken) {
          socket.emit("identify", { userId, token: accessToken });
        }
        setListeningState("listening");
      });

      socket.on("disconnect", () => {
        if (store.getState().listeningState === "listening") {
          setListeningState("paused");
        }
      });

      socket.on("connect_error", (err) => {
        setLastError(err.message || "Failed to connect to narration server");
        setListeningState("error");
        onError?.(err.message || "Connection error");
      });

      socket.on("narration:receive", (payload: TriageOutput) => {
        if (!payload || !payload.text) return;
        triggerHaptic(payload.hapticPattern, store.getState().settings.hapticsEnabled);
        speak(payload.text, payload.tier);
        onNarration?.(payload);
      });

      socket.on("narration:error", (payload: { message?: string }) => {
        setLastError(payload.message ?? "Narration error");
      });

      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }

      const loop = () => {
        const now = performance.now();
        const interval = store.getState().settings.frameIntervalMs;
        if (
          now - lastFrameAtRef.current >= interval &&
          socket.connected &&
          videoRef.current &&
          videoRef.current.readyState >= 2
        ) {
          const video = videoRef.current;
          const canvas = canvasRef.current!;
          const w = Math.min(video.videoWidth || 640, 640);
          const h = Math.min(video.videoHeight || 360, 360);
          if (w > 0 && h > 0) {
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              try {
                const jpeg = canvas.toDataURL("image/jpeg", 0.55);
                const base64 = jpeg.includes(",") ? jpeg.split(",")[1] : jpeg;
                socket.emit("frame:send", {
                  frame: base64,
                  geolocation: lastKnownGeoRef.current,
                });
                lastFrameAtRef.current = now;
              } catch (e) {
                console.warn("Frame encode failed", e);
              }
            }
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start narration";
      setLastError(msg);
      setListeningState("error");
      onError?.(msg);
      stopEverything();
    }
  }, [stopEverything, videoRef, userId, accessToken, setListeningState, setLastError, onError, onNarration, speak, store]);

  useEffect(() => {
    if (listeningState === "listening" || listeningState === "requesting") {
      startCapture();
    } else {
      stopEverything();
    }
    return () => {
      stopEverything();
    };
  }, [listeningState, startCapture, stopEverything]);

  useEffect(() => {
    if (socketRef.current && socketRef.current.connected && userId) {
      socketRef.current.emit("identify", { userId, token: accessToken });
    }
  }, [userId, accessToken]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  return null;
}
