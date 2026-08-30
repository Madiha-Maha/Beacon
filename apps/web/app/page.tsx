"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import ListeningIndicator from "@/components/ListeningIndicator";
import { beaconApi } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";

type Step = "welcome" | "permissions" | "auth" | "done";
type AuthMode = "login" | "register";

const REQUIREMENTS = [
  {
    key: "camera",
    title: "Camera access",
    blurb: "To see what's around you and describe it.",
    test: async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices) return false;
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: 320, height: 240 },
          audio: false,
        });
        s.getTracks().forEach((t) => t.stop());
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    key: "tts",
    title: "Speech synthesis",
    blurb: "Narration voice output through your speaker or earbuds.",
    test: async () =>
      typeof window !== "undefined" && "speechSynthesis" in window,
  },
  {
    key: "geo",
    title: "Location (optional)",
    blurb: "Hazard mesh nearby lookups and hazard tagging.",
    test: async () =>
      typeof navigator !== "undefined" && "geolocation" in navigator,
  },
  {
    key: "vibrate",
    title: "Haptics (optional)",
    blurb: "Distinct vibration patterns for hazards and social cues.",
    test: async () =>
      typeof navigator !== "undefined" && "vibrate" in navigator,
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean | null>>({});
  const setAuth = useAppStore((s) => s.setAuth);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const contrast = useAppStore((s) => s.settings.contrast);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-contrast", contrast);
    }
  }, [contrast]);

  const runChecks = async () => {
    const results: Record<string, boolean | null> = {};
    for (const r of REQUIREMENTS) {
      results[r.key] = null;
    }
    setChecks(results);
    for (const r of REQUIREMENTS) {
      try {
        results[r.key] = await r.test();
      } catch {
        results[r.key] = false;
      }
      setChecks({ ...results });
    }
  };

  const onSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      const res =
        mode === "register"
          ? await beaconApi.register({ email, password })
          : await beaconApi.login({ email, password });
      setAuth({ userId: res.user.id, accessToken: res.accessToken });
      setStep("done");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-10 md:py-16 flex items-center justify-center">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-primary/90 shadow-signal-glow" />
          <div>
            <h1 className="text-2xl md:text-3xl leading-none">Beacon</h1>
            <div className="text-sm text-text-dim">
              Real-time AI sight companion
            </div>
          </div>
        </div>

        {step === "welcome" && (
          <section className="surface p-6 md:p-8 animate-tier-fade">
            <h2 className="text-xl md:text-2xl mb-4">How Beacon works</h2>
            <ol className="space-y-3 text-text-dim mb-8">
              <li>
                1. <span className="text-text">Grant camera & audio permissions.</span>
              </li>
              <li>
                2. <span className="text-text">Beacon streams frames to our triage engine.</span>
              </li>
              <li>
                3. <span className="text-text">Hazards are narrated first, then social cues, then ambient detail.</span>
              </li>
              <li>
                4. <span className="text-text">Wear bone-conduction earbuds and keep your phone in a pocket.</span>
              </li>
            </ol>

            <div className="flex flex-wrap gap-3 items-center justify-between">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const next = contrast === "high" ? "normal" : "high";
                  updateSettings({ contrast: next });
                }}
              >
                {contrast === "high" ? "Normal contrast" : "High contrast"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setStep("permissions")}
              >
                Get started →
              </button>
            </div>
          </section>
        )}

        {step === "permissions" && (
          <section className="surface p-6 md:p-8 animate-tier-fade">
            <h2 className="text-xl md:text-2xl mb-2">Check permissions</h2>
            <p className="text-text-dim mb-6">
              Beacon needs a few browser capabilities. Tap each check to grant the permission.
            </p>
            <ul className="space-y-3 mb-6">
              {REQUIREMENTS.map((r) => {
                const c = checks[r.key];
                return (
                  <li
                    key={r.key}
                    className={clsx(
                      "flex items-start gap-3 p-3 rounded-xl border",
                      c === true
                        ? "border-primary/50 bg-primary/5"
                        : c === false
                          ? "border-hazard/40 bg-hazard/5"
                          : "border-bg-border"
                    )}
                  >
                    <div
                      className={clsx(
                        "mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold",
                        c === true
                          ? "bg-primary text-primary-ink"
                          : c === false
                            ? "bg-hazard text-white"
                            : "bg-bg-border text-text-dim"
                      )}
                    >
                      {c === true ? "✓" : c === false ? "!" : "?"}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{r.title}</div>
                      <div className="text-sm text-text-dim">{r.blurb}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-ghost" onClick={() => setStep("welcome")}>
                Back
              </button>
              <button type="button" className="btn-primary" onClick={runChecks}>
                Run permission check
              </button>
              <button type="button" className="btn-ghost" onClick={() => setStep("auth")}>
                Continue to account →
              </button>
            </div>
          </section>
        )}

        {step === "auth" && (
          <section className="surface p-6 md:p-8 animate-tier-fade">
            <div className="flex gap-2 mb-6 p-1 rounded-xl bg-bg-elev border border-bg-border w-full max-w-xs mx-auto">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={clsx(
                    "flex-1 py-2 rounded-lg font-semibold capitalize transition",
                    mode === m
                      ? "bg-primary text-primary-ink"
                      : "text-text-dim hover:text-text"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <form onSubmit={onSubmitAuth} className="space-y-4">
              <label className="block">
                <span className="block mb-1 text-sm text-text-dim">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="block mb-1 text-sm text-text-dim">Password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {formError && (
                <div className="text-hazard text-sm font-semibold">
                  {formError}
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="button" className="btn-ghost" onClick={() => setStep("permissions")}>
                  Back
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
                </button>
              </div>
              <button
                type="button"
                className="w-full text-sm text-text-dim underline underline-offset-4 pt-4"
                onClick={() => {
                  setAuth({ userId: "anon", accessToken: null });
                  setStep("done");
                }}
              >
                Or try Beacon without an account (local-only)
              </button>
            </form>
          </section>
        )}

        {step === "done" && (
          <section className="surface p-6 md:p-8 flex flex-col items-center text-center animate-tier-fade">
            <ListeningIndicator size="md" />
            <h2 className="mt-4 text-xl md:text-2xl">You're ready</h2>
            <p className="text-text-dim max-w-md mt-2">
              Head to the live narration screen, tap the big amber button, and keep your phone
              in a breast pocket or lanyard pointing forward.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-6">
              <Link href="/settings" className="btn-ghost">
                Configure voice & haptics
              </Link>
              <Link href="/live" className="btn-primary">
                Start listening →
              </Link>
            </div>
          </section>
        )}

        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-dim justify-center">
          <Link href="/live" className="hover:text-primary transition">Live</Link>
          <Link href="/hazard-map" className="hover:text-primary transition">Hazard map</Link>
          <Link href="/settings" className="hover:text-primary transition">Settings</Link>
        </nav>
      </div>
    </main>
  );
}
