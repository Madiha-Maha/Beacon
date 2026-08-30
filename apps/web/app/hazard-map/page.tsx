"use client";

import Link from "next/link";
import HazardMapView from "@/components/HazardMapView";

export default function HazardMapPage() {
  return (
    <main className="min-h-screen flex flex-col px-4 py-6 md:px-8 md:py-10 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/90" />
          <span className="font-bold text-lg">Beacon</span>
        </Link>
        <nav className="flex gap-2 text-sm">
          <Link href="/live" className="btn-ghost !py-1.5 !px-3">
            Live
          </Link>
          <Link href="/settings" className="btn-ghost !py-1.5 !px-3">
            Settings
          </Link>
        </nav>
      </header>

      <section className="mb-4">
        <h1 className="text-2xl mb-1">Community Hazard Mesh</h1>
        <p className="text-text-dim">
          Crowdsourced reports from all Beacon users near you. Reports expire
          automatically after ~72 hours, or sooner if city services confirm
          cleanup.
        </p>
      </section>

      <HazardMapView />
    </main>
  );
}
