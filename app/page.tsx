import LogForm from "@/components/LogForm";
import DateTimeDisplay from "@/components/DateTimeDisplay";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-hero-grad-a to-hero-grad-b px-4 py-12 font-sans text-ink-700">
      {/* Decorative moving gradient blobs - Soft blue accents */}
      <div className="absolute -top-40 -left-40 h-[450px] w-[450px] rounded-full bg-brand-blue-200/25 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-40 h-[450px] w-[450px] rounded-full bg-brand-blue-300/20 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-brand-blue-100/15 blur-[160px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="absolute top-0 left-0 right-0 flex flex-wrap items-center justify-between gap-3 border-b border-surface-200 bg-white/70 px-4 py-3 backdrop-blur-md z-10 shadow-sm sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          {/* StartupLab Logo Icon - uses StartupLab's trademark gradient theme */}
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-blue-600 to-brand-blue-500 shadow-sm">
            <span className="font-display text-lg font-black text-white">S</span>
          </div>
          <div>
            <span className="font-display font-extrabold tracking-tight text-ink-900">
              Startup<span className="text-brand-blue-600">Lab</span>
            </span>
            <span className="ml-2 rounded-full bg-brand-blue-100/60 border border-brand-blue-200/50 px-2 py-0.5 text-[10px] font-bold text-brand-blue-600 tracking-wider">
              KIOSK
            </span>
          </div>
        </div>

        <DateTimeDisplay />

        <Link
          href="/login"
          className="rounded-xl border border-surface-200 bg-white px-4 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-brand-blue-300 hover:bg-brand-blue-50/50 hover:text-brand-blue-600 shadow-sm"
        >
          🔑 Admin Portal
        </Link>
      </header>

      {/* Main Kiosk Dashboard */}
      <div className="z-10 flex w-full flex-col items-center gap-8 mt-12">
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

      {/* Privacy-Compliant Footer */}
      <footer className="absolute bottom-4 text-center text-ink-400 text-[11px] pointer-events-none font-medium tracking-wide">
        StartupLab Kiosk System • Privacy & GDPR Compliant • Powered by Supabase
      </footer>
    </main>
  );
}
