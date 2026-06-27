import Image from "next/image";
import Link from "next/link";
import DateTimeDisplay from "@/components/shared/DateTimeDisplay";

export default function KioskNavbar() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-200 bg-white/70 px-4 py-3 backdrop-blur-md shadow-sm sm:px-6 sm:py-4">
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 sm:h-20 sm:w-20 flex-shrink-0">
          <Image src="/Company_Logo.png" alt="Company logo" fill className="object-contain" />
        </div>
        <div className="relative h-20 w-[240px] sm:h-24 sm:w-[150px] -translate-x-3 sm:-translate-x-5">
          <Image src="/Company_Text_Black.png" alt="StartupLab Business Center" fill className="object-contain" />
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
  );
}
