"use client";

import { useCallback, useEffect, useState } from "react";
import { getStaffInternUsers, registerStaffOrIntern, createActivityLog } from "@/lib/logs";
import type { RegistrableRole } from "@/lib/logs";
import type { User, UserState } from "@/lib/supabase";
import { playClickSound } from "@/lib/audio";

const ROLE_OPTIONS: { value: RegistrableRole; label: string; emoji: string }[] = [
  { value: "staff", label: "Staff", emoji: "👔" },
  { value: "intern", label: "Intern", emoji: "🎓" },
];

const STATE_BADGE: Record<UserState, { label: string; className: string }> = {
  in_office: {
    label: "In Office",
    className: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  out_of_office: {
    label: "Out of Office",
    className: "bg-slate-50 border-slate-200 text-slate-600",
  },
  on_break: {
    label: "On Break",
    className: "bg-amber-50 border-amber-200 text-amber-700",
  },
};

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function UserRegistrationPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<RegistrableRole>("staff");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const data = await getStaffInternUsers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    playClickSound();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFeedback({ type: "error", message: "Please enter a name." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const user = await registerStaffOrIntern(trimmedName, role);
      await createActivityLog(
        "REGISTER_USER",
        `Admin registered ${user.name} as ${user.role}`
      );
      setFeedback({
        type: "success",
        message: `${user.name} has been registered as ${user.role}.`,
      });
      setName("");
      await loadUsers();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Registration failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const filteredUsers = searchFilter.trim()
    ? users.filter((u) =>
        u.name.toLowerCase().includes(searchFilter.trim().toLowerCase())
      )
    : users;

  return (
    <div className="z-10 flex flex-col gap-5 animate-fadeIn">
      {/* Registration Form Card */}
      <div className="rounded-[18px] border border-surface-200 bg-white p-6 shadow-[0_12px_30px_-10px_rgba(49,94,239,0.08)]">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-brand-blue-50 text-brand-blue-600">
            <PlusIcon />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink-900">Register New User</h2>
            <p className="text-[11px] font-medium text-ink-500">
              Add a staff member or intern to the system
            </p>
          </div>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label
                htmlFor="reg-name"
                className="text-[10px] font-bold text-ink-500 uppercase tracking-wider"
              >
                Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                disabled={submitting}
                className="rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder-ink-400 outline-none transition focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500/20 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="reg-role"
                className="text-[10px] font-bold text-ink-500 uppercase tracking-wider"
              >
                Role
              </label>
              <select
                id="reg-role"
                value={role}
                onChange={(e) => {
                  playClickSound();
                  setRole(e.target.value as RegistrableRole);
                }}
                disabled={submitting}
                className="rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-blue-500 cursor-pointer disabled:opacity-50"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.emoji} {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-blue-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Registering…
                </>
              ) : (
                <>
                  <PlusIcon />
                  Register User
                </>
              )}
            </button>

            {feedback && (
              <p
                className={`text-xs font-bold transition animate-fadeIn ${
                  feedback.type === "success"
                    ? "text-emerald-600"
                    : "text-red-500"
                }`}
              >
                {feedback.type === "success" ? "✓" : "✕"} {feedback.message}
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Registered Users Table Card */}
      <div className="rounded-[18px] border border-surface-200 bg-white shadow-[0_8px_20px_-8px_rgba(49,94,239,0.05)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-brand-blue-50 text-brand-blue-600">
              <UserIcon />
            </div>
            <div>
              <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
                Registered Staff & Interns
              </h3>
              <p className="text-[10px] font-medium text-ink-400">
                {users.length} user{users.length !== 1 ? "s" : ""} registered
              </p>
            </div>
          </div>

          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter by name…"
            className="w-48 rounded-xl border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs text-ink-700 placeholder-ink-400 outline-none transition focus:border-brand-blue-500 focus:bg-white"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-blue-600" />
              <p className="text-xs text-ink-500 font-semibold">Loading users…</p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <div className="text-3xl">📋</div>
            <p className="text-sm font-semibold text-ink-500">
              No staff or interns registered yet.
            </p>
            <p className="text-xs text-ink-400">
              Use the form above to register your first user.
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-1">
            <p className="text-sm font-semibold text-ink-500">
              No users match &ldquo;{searchFilter}&rdquo;
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead className="bg-surface-50 text-ink-500 border-b border-surface-200">
              <tr>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-xs">
                  Name
                </th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-xs">
                  Role
                </th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-xs">
                  Status
                </th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-xs">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filteredUsers.map((user) => {
                const stateBadge = STATE_BADGE[user.state] ?? STATE_BADGE.out_of_office;
                return (
                  <tr
                    key={user.name}
                    className="transition hover:bg-brand-blue-50/20"
                  >
                    <td className="px-5 py-3 font-bold text-ink-900">
                      {user.name}
                    </td>
                    <td className="px-5 py-3 capitalize font-medium text-ink-600">
                      {user.role === "staff" ? "👔" : "🎓"} {user.role}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${stateBadge.className}`}
                      >
                        {stateBadge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-500 font-medium">
                      {new Date(user.updated_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
