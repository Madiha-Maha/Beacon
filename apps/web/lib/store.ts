import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ListeningState = "idle" | "requesting" | "listening" | "paused" | "error";

export type ContrastMode = "normal" | "high";

interface AppSettings {
  contrast: ContrastMode;
  voiceRate: number;
  voicePitch: number;
  hapticsEnabled: boolean;
  ttsEnabled: boolean;
  ambientNarration: boolean;
  selectedVoiceUri: string | null;
  frameIntervalMs: number;
}

interface AppState {
  listeningState: ListeningState;
  setListeningState: (s: ListeningState) => void;
  lastError: string | null;
  setLastError: (e: string | null) => void;
  userId: string | null;
  accessToken: string | null;
  setAuth: (payload: { userId: string | null; accessToken: string | null }) => void;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  contrast: "normal",
  voiceRate: 1.0,
  voicePitch: 1.0,
  hapticsEnabled: true,
  ttsEnabled: true,
  ambientNarration: true,
  selectedVoiceUri: null,
  frameIntervalMs: 1800,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      listeningState: "idle",
      setListeningState: (s) => set({ listeningState: s }),
      lastError: null,
      setLastError: (e) => set({ lastError: e }),
      userId: null,
      accessToken: null,
      setAuth: ({ userId, accessToken }) => set({ userId, accessToken }),
      settings: DEFAULT_SETTINGS,
      updateSettings: (patch) => {
        const next = { ...get().settings, ...patch };
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute(
            "data-contrast",
            next.contrast
          );
          try {
            localStorage.setItem(
              "beacon.contrast",
              next.contrast
            );
          } catch {
            // ignore
          }
        }
        set({ settings: next });
      },
    }),
    {
      name: "beacon-app-state-v1",
      partialize: (s) => ({
        userId: s.userId,
        accessToken: s.accessToken,
        settings: s.settings,
      }),
    }
  )
);

export function applyContrastFromStore() {
  if (typeof document === "undefined") return;
  const { settings } = useAppStore.getState();
  document.documentElement.setAttribute(
    "data-contrast",
    settings.contrast
  );
}
