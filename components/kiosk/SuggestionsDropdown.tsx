"use client";

import type { UserRole } from "@/lib/supabase";

interface Suggestion {
  name: string;
  role: UserRole;
}

interface SuggestionsDropdownProps {
  suggestions: Suggestion[];
  selectedRole: UserRole;
  onSelect: (suggestion: Suggestion) => void;
}

function normalizeRole(role: UserRole | string) {
  return role.toLowerCase();
}

export default function SuggestionsDropdown({ suggestions, selectedRole, onSelect }: SuggestionsDropdownProps) {
  const roleSuggestions = suggestions.filter((suggestion) => normalizeRole(suggestion.role) === normalizeRole(selectedRole));

  if (roleSuggestions.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-48 overflow-y-auto rounded-xl border border-surface-200 bg-white shadow-lg">
      {roleSuggestions.map((suggestion, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelect(suggestion)}
          className="flex w-full cursor-pointer items-center justify-between border-b border-surface-100 px-3 py-2.5 text-left text-xs font-medium transition hover:bg-brand-blue-50 hover:text-brand-blue-600 last:border-0"
        >
          <span className="font-bold text-ink-900">{suggestion.name}</span>
          <span className="rounded bg-brand-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase text-brand-blue-500">{suggestion.role}</span>
        </button>
      ))}
    </div>
  );
}
