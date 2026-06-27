"use client";

import type { LogType } from "@/lib/supabase";
import { playClickSound } from "@/lib/audio";

interface ActionSelectorProps {
  onSelect: (type: LogType) => void;
}

export default function ActionSelector({ onSelect }: ActionSelectorProps) {
  function handleSelect(type: LogType) {
    playClickSound();
    onSelect(type);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <button
        type="button"
        onClick={() => handleSelect("login")}
        className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-brand-blue-100 bg-brand-blue-50/30 px-4 py-8 text-center shadow-sm transition duration-200 hover:scale-102 hover:bg-brand-blue-50 active:scale-98"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue-500 text-white shadow-md shadow-brand-blue-100 transition group-hover:scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        </div>
        <span className="text-base font-extrabold text-ink-900">Log In</span>
        <span className="text-xs font-medium text-ink-500"></span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect("break")}
        className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-brand-blue-100 bg-brand-blue-50/30 px-4 py-8 text-center shadow-sm transition duration-200 hover:scale-102 hover:bg-brand-blue-50 active:scale-98"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue-500 text-white shadow-md shadow-brand-blue-100 transition group-hover:scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="9" x2="9" y2="15"/><line x1="15" y1="9" x2="15" y2="15"/></svg>
        </div>
        <span className="text-base font-extrabold text-ink-900">Take Break</span>
        <span className="text-xs font-medium text-ink-500"></span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect("logout")}
        className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-brand-blue-100 bg-brand-blue-50/30 px-4 py-8 text-center shadow-sm transition duration-200 hover:scale-102 hover:bg-brand-blue-50 active:scale-98"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue-500 text-white shadow-md shadow-brand-blue-100 transition group-hover:scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
        <span className="text-base font-extrabold text-ink-900">Log Out</span>
        <span className="text-xs font-medium text-ink-500"></span>
      </button>
    </div>
  );
}
