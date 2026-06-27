"use client";

import { useRef, useMemo, useState } from "react";
import { playClickSound } from "@/lib/audio";
import type { LogType, UserRole } from "@/lib/supabase";

type SortKey = "date-desc" | "date-asc" | "name-asc" | "name-desc";
type TypeFilter = "all" | LogType;
type RoleFilter = "all" | UserRole;

interface NameSuggestion {
  name: string;
  role: UserRole;
}

interface FilterBarProps {
  search: string;
  dateFrom: string;
  dateTo: string;
  typeFilter: TypeFilter;
  roleFilter: RoleFilter;
  sortBy: SortKey;
  totalLogs: number;
  visibleCount: number;
  hasFilters: boolean;
  nameSuggestions: NameSuggestion[];
  onSearchChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onTypeFilterChange: (value: TypeFilter) => void;
  onRoleFilterChange: (value: RoleFilter) => void;
  onSortByChange: (value: SortKey) => void;
  onClearFilters: () => void;
}

export default function FilterBar({
  search,
  dateFrom,
  dateTo,
  typeFilter,
  roleFilter,
  sortBy,
  totalLogs,
  visibleCount,
  hasFilters,
  nameSuggestions,
  onSearchChange,
  onDateFromChange,
  onDateToChange,
  onTypeFilterChange,
  onRoleFilterChange,
  onSortByChange,
  onClearFilters,
}: FilterBarProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive filtered suggestions from the already-loaded list in memory.
  // Filter by selected role first, then by the current search keyword.
  // This avoids any additional network calls — pure in-memory filtering.
  const filteredSuggestions = useMemo(() => {
    const roleFiltered =
      roleFilter === "all"
        ? nameSuggestions
        : nameSuggestions.filter(
            (s) => s.role.toLowerCase() === roleFilter.toLowerCase()
          );

    const term = search.trim().toLowerCase();
    if (term.length === 0) return roleFiltered.slice(0, 12);

    return roleFiltered
      .filter(
        (s) =>
          s.name.toLowerCase().includes(term) &&
          s.name.toLowerCase() !== term
      )
      .slice(0, 12);
  }, [nameSuggestions, roleFilter, search]);

  function handleFocus() {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setShowSuggestions(true);
  }

  function handleBlur() {
    blurTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 200);
  }

  function handleSelectSuggestion(suggestion: NameSuggestion) {
    playClickSound();
    onSearchChange(suggestion.name);
    // Also set the role filter to match the suggestion for a seamless UX
    if (roleFilter === "all") {
      onRoleFilterChange(suggestion.role as RoleFilter);
    }
    setShowSuggestions(false);
  }

  return (
    <div className="z-10 flex flex-col gap-4 rounded-[18px] border border-surface-200 bg-white p-5 shadow-[0_12px_30px_-10px_rgba(49,94,239,0.08)]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Role filter */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">
            Role
          </label>
          <select
            id="role"
            value={roleFilter}
            onChange={(e) => { playClickSound(); onRoleFilterChange(e.target.value as RoleFilter); }}
            className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500 cursor-pointer"
          >
            <option value="all">All roles</option>
            <option value="staff">Staff</option>
            <option value="intern">Intern</option>
            <option value="guest">Guest</option>
            <option value="client">Client</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Search name with autocomplete */}
        <div className="relative flex flex-col gap-1.5">
          <label htmlFor="search" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">
            Search name
          </label>
          <input
            id="search"
            type="text"
            value={search}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={roleFilter === "all" ? "e.g. Alex" : `Search ${roleFilter}s…`}
            className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 placeholder-ink-400 outline-none transition focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500/20"
          />

          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-xl border border-surface-200 bg-white shadow-lg animate-fadeIn">
              {filteredSuggestions.map((suggestion, idx) => (
                <button
                  key={`${suggestion.name}-${suggestion.role}-${idx}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="flex w-full cursor-pointer items-center justify-between border-b border-surface-100 px-3 py-2.5 text-left text-xs font-medium transition hover:bg-brand-blue-50 hover:text-brand-blue-600 last:border-0"
                >
                  <span className="font-bold text-ink-900">{suggestion.name}</span>
                  <span className="rounded bg-brand-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase text-brand-blue-500">
                    {suggestion.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Type filter */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="type" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">
            Type
          </label>
          <select
            id="type"
            value={typeFilter}
            onChange={(e) => { playClickSound(); onTypeFilterChange(e.target.value as TypeFilter); }}
            className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500 cursor-pointer"
          >
            <option value="all">All types</option>
            <option value="login">Log In</option>
            <option value="break">Break</option>
            <option value="logout">Log Out</option>
          </select>
        </div>

        {/* From date */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">
            From date
          </label>
          <input
            id="from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500 [color-scheme:light]"
          />
        </div>

        {/* To date */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">
            To date
          </label>
          <input
            id="to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => onDateToChange(e.target.value)}
            className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500 [color-scheme:light]"
          />
        </div>

        {/* Sort by */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sort" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">
            Sort by
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => { playClickSound(); onSortByChange(e.target.value as SortKey); }}
            className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500 cursor-pointer"
          >
            <option value="date-desc">Date (newest first)</option>
            <option value="date-asc">Date (oldest first)</option>
            <option value="name-asc">Name (A–Z)</option>
            <option value="name-desc">Name (Z–A)</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-surface-100 pt-3">
        <span className="text-xs text-ink-400 font-semibold">
          {visibleCount} of {totalLogs} entries matching search query
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-brand-blue-600 hover:text-brand-blue-500 font-bold transition"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
