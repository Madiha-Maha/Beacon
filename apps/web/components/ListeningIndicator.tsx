"use client";

import clsx from "clsx";
import { useAppStore, type ListeningState } from "@/lib/store";

interface Props {
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "w-16 h-16 border-[3px]",
  md: "w-28 h-28 border-4",
  lg: "w-40 h-40 border-[5px]",
};

const STATE_LABEL: Record<ListeningState, string> = {
  idle: "Standby",
  requesting: "Requesting permissions…",
  listening: "Live narration",
  paused: "Paused",
  error: "Trouble connecting",
};

export default function ListeningIndicator({ size = "lg" }: Props) {
  const state = useAppStore((s) => s.listeningState);
  const active = state === "listening";
  const hazard = state === "error";

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div
        className={clsx(
          "relative rounded-full border-primary transition-all duration-200",
          SIZE_CLASS[size],
          !active && !hazard && "opacity-70",
          hazard && "border-hazard"
        )}
        style={{ borderStyle: "solid" }}
        aria-hidden="true"
      >
        <div
          className={clsx(
            "absolute inset-0 rounded-full",
            active && !hazard && "animate-ring-pulse",
            hazard && "animate-ring-hazard",
            !active && !hazard && "bg-primary/10"
          )}
          style={{
            background: hazard
              ? "radial-gradient(circle, rgba(255,84,84,0.25), transparent 70%)"
              : active
                ? "radial-gradient(circle, rgba(255,184,76,0.35), transparent 70%)"
                : undefined,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={clsx(
              "rounded-full",
              size === "sm" && "w-5 h-5",
              size === "md" && "w-9 h-9",
              size === "lg" && "w-12 h-12",
              hazard ? "bg-hazard" : active ? "bg-primary" : "bg-primary/70"
            )}
            style={{
              boxShadow: active
                ? hazard
                  ? "0 0 14px rgba(255,84,84,0.7)"
                  : "0 0 14px rgba(255,184,76,0.7)"
                : undefined,
            }}
          />
        </div>
      </div>
      <div
        className={clsx(
          "text-center font-semibold tracking-wide",
          hazard ? "text-hazard" : "text-text-dim"
        )}
      >
        {STATE_LABEL[state]}
      </div>
    </div>
  );
}
