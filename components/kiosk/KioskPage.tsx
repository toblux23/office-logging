"use client";

import LogForm from "./LogForm";
import KioskNavbar from "./KioskNavbar";

export default function KioskPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-hero-grad-a to-hero-grad-b font-sans text-ink-700">
      <div className="absolute -top-40 -left-40 h-[450px] w-[450px] rounded-full bg-brand-blue-200/25 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-40 h-[450px] w-[450px] rounded-full bg-brand-blue-300/20 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-brand-blue-100/15 blur-[160px] pointer-events-none" />

      <KioskNavbar />

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="flex w-full flex-col items-center gap-8">
          <div className="text-center animate-fadeIn">
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
              StartupLab Office Logging
            </h1>
            <p className="mt-3 text-sm text-ink-500 max-w-md mx-auto leading-relaxed">
              Welcome to the StartupLab workspace. Please select an action below to begin your logging session.
            </p>
          </div>

          <LogForm />
        </div>
      </div>

      <footer className="py-4 text-center text-ink-400 text-[11px] pointer-events-none font-medium tracking-wide">
        StartupLab Kiosk System • Privacy & GDPR Compliant • Powered by Supabase
      </footer>
    </main>
  );
}
