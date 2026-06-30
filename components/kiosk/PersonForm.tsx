"use client";

import { useRef, useState } from "react";
import type { UserRole } from "@/lib/supabase";
import { calculateStreak } from "@/lib/logs";
import { playClickSound } from "@/lib/audio";
import SuggestionsDropdown from "./SuggestionsDropdown";
import type { LogEntry } from "@/lib/supabase";

interface Person {
  name: string;
  role: UserRole;
}

interface Suggestion {
  name: string;
  role: UserRole;
}

interface PersonFormProps {
  people: Person[];
  allLogs: LogEntry[];
  suggestions: Suggestion[];
  saving: boolean;
  maxPeople: number;
  onUpdateName: (index: number, value: string) => void;
  onUpdateRole: (index: number, role: UserRole) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onSelectSuggestion: (index: number, suggestion: Suggestion) => void;
}

function normalizeRole(role: UserRole | string) {
  return role.toLowerCase();
}

export default function PersonForm({
  people,
  allLogs,
  suggestions,
  saving,
  maxPeople,
  onUpdateName,
  onUpdateRole,
  onRemove,
  onAdd,
  onSelectSuggestion,
}: PersonFormProps) {
  const [activeInputIdx, setActiveInputIdx] = useState<number | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showSuggestions(index: number) {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    setActiveInputIdx(index);
  }

  function hideSuggestionsSoon() {
    blurTimeoutRef.current = setTimeout(() => setActiveInputIdx(null), 250);
  }

  function handleSelectSuggestion(index: number, suggestion: Suggestion) {
    playClickSound();
    onSelectSuggestion(index, suggestion);
    setActiveInputIdx(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-ink-500">Session Colleagues ({people.length}/{maxPeople})</label>
        <button
          type="button"
          onClick={() => { playClickSound(); onAdd(); }}
          disabled={saving || people.length >= maxPeople}
          className="cursor-pointer text-xs font-extrabold text-brand-blue-600 transition hover:text-brand-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ➕ Add Friend
        </button>
      </div>

      {people.map((person, index) => {
        const streak = calculateStreak(allLogs, person.name);
        const roleSuggestions = suggestions.filter((s) => normalizeRole(s.role) === normalizeRole(person.role));
        const filteredSuggestions = person.name.trim().length === 0
          ? roleSuggestions.slice(0, 10)
          : roleSuggestions.filter(
              (s) =>
                s.name.toLowerCase().includes(person.name.toLowerCase()) &&
                s.name.toLowerCase() !== person.name.toLowerCase()
            );

        return (
          <div key={index} className="relative flex flex-col gap-2 rounded-2xl border border-brand-blue-100 bg-brand-blue-50/20 p-4 shadow-sm">
            {index > 0 && (
              <button
                type="button"
                onClick={() => { playClickSound(); onRemove(index); }}
                disabled={saving}
                title="Remove person"
                className="absolute right-2 top-2 cursor-pointer rounded-xl p-1.5 text-ink-400 transition hover:bg-brand-blue-100 hover:text-brand-blue-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            )}

            <div className="flex items-start gap-3">
              <div className="relative flex-1">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-500">Name</label>
                <input
                  type="text"
                  value={person.name}
                  onFocus={() => showSuggestions(index)}
                  onBlur={hideSuggestionsSoon}
                  onChange={(e) => onUpdateName(index, e.target.value)}
                  placeholder="e.g. Alex"
                  disabled={saving}
                  className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 placeholder-ink-400 outline-none transition focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500/20"
                />

                {activeInputIdx === index && filteredSuggestions.length > 0 && (
                  <SuggestionsDropdown
                    suggestions={filteredSuggestions}
                    onSelect={(s) => handleSelectSuggestion(index, s)}
                  />
                )}
              </div>

              <div className="w-[120px]">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-500">Role</label>
                <select
                  value={person.role}
                  onChange={(e) => { playClickSound(); onUpdateRole(index, e.target.value as UserRole); }}
                  disabled={saving}
                  className="w-full cursor-pointer rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500"
                >
                  <option value="intern">Intern</option>
                  <option value="staff">Staff</option>
                  <option value="guest">Guest</option>
                  <option value="client">Client</option>
                </select>
              </div>
            </div>

            {person.name.trim().length > 0 && streak > 0 && (
              <div className="mt-1 flex items-center gap-2">
                <span className="animate-pulse rounded-full border border-brand-blue-200 bg-brand-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-brand-blue-600">
                  🔥 {streak}-Day Streak Active
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
