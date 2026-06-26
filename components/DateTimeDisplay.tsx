"use client";

import { useEffect, useState } from "react";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const COMPACT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

export default function DateTimeDisplay() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());

    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const displayDate = now ? DATE_FORMATTER.format(now) : "Loading date";
  const compactDate = now ? COMPACT_DATE_FORMATTER.format(now) : "Loading date";
  const displayTime = now ? TIME_FORMATTER.format(now) : "--:--:--";

  return (
    <div
      className="order-3 flex w-full items-center justify-center rounded-xl border border-brand-blue-100 bg-white/80 px-3 py-2 text-center shadow-sm sm:order-none sm:w-auto sm:min-w-[280px] sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2"
      aria-live="polite"
      aria-label={`Current date and time: ${displayDate}, ${displayTime}`}
    >
      <div className="flex flex-col leading-tight">
        <span className="hidden text-[11px] font-bold uppercase tracking-wider text-brand-blue-600 sm:block">
          {displayDate}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-blue-600 sm:hidden">
          {compactDate}
        </span>
        <span className="mt-0.5 font-display text-lg font-extrabold tabular-nums text-ink-900">
          {displayTime}
        </span>
      </div>
    </div>
  );
}
