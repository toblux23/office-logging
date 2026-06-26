"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getLogs, getActivityLogs, createActivityLog, calculateStreak } from "@/lib/logs";
import { supabase, IS_MOCK } from "@/lib/supabase";
import type { LogEntry, LogType, AdminActivityLog } from "@/lib/supabase";
import { playClickSound } from "@/lib/audio";

type SortKey = "date-desc" | "date-asc" | "name-asc" | "name-desc";
type TypeFilter = "all" | LogType;

const TYPE_LABEL: Record<LogType, string> = {
  login: "Log In",
  break: "Break",
  logout: "Log Out",
};

const TYPE_BADGE: Record<LogType, string> = {
  login: "bg-brand-blue-50 border border-brand-blue-100 text-brand-blue-700",
  break: "bg-brand-blue-50 border border-brand-blue-100 text-brand-blue-700",
  logout: "bg-brand-blue-50 border border-brand-blue-100 text-brand-blue-700",
};

export default function LogsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"attendance" | "security">("attendance");
  const [securityLogs, setSecurityLogs] = useState<AdminActivityLog[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);

  // Filters & sorting
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("date-desc");

  // Row clicked to view in the popup.
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // Require an authenticated admin
  useEffect(() => {
    if (IS_MOCK) {
      const session = localStorage.getItem("mock_admin_session") === "true";
      if (!session) {
        router.replace("/login");
        return;
      }
      setAuthChecked(true);
      getLogs()
        .then(async (fetchedLogs) => {
          setLogs(fetchedLogs);
          await createActivityLog("VIEW_LOGS", "Admin viewed attendance logs database (Local Mock)");
        })
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Failed to load logs.")
        )
        .finally(() => setLoading(false));
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          router.replace("/login");
          return;
        }
        setAuthChecked(true);
        getLogs()
          .then(async (fetchedLogs) => {
            setLogs(fetchedLogs);
            await createActivityLog("VIEW_LOGS", "Admin viewed attendance logs database");
          })
          .catch((e) =>
            setError(e instanceof Error ? e.message : "Failed to load logs.")
          )
          .finally(() => setLoading(false));
      });
    }
  }, [router]);

  // Fetch security audit logs when switching tabs
  useEffect(() => {
    if (activeTab === "security" && authChecked) {
      setSecurityLoading(true);
      getActivityLogs()
        .then(setSecurityLogs)
        .catch((e) => console.error("Failed to load security logs:", e))
        .finally(() => setSecurityLoading(false));
    }
  }, [activeTab, authChecked]);

  async function signOut() {
    playClickSound();
    if (IS_MOCK) {
      await createActivityLog("SIGN_OUT", "Admin signed out successfully (Local Mock)");
      localStorage.removeItem("mock_admin_session");
    } else {
      await createActivityLog("SIGN_OUT", "Admin signed out successfully");
      await supabase.auth.signOut();
    }
    router.replace("/login");
  }

  const visibleLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59.999").getTime() : null;

    const filtered = logs.filter((log) => {
      if (term && !log.name.toLowerCase().includes(term)) return false;
      if (typeFilter !== "all" && log.type !== typeFilter) return false;
      const ts = new Date(log.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "date-asc":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "date-desc":
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    return sorted;
  }, [logs, search, dateFrom, dateTo, typeFilter, sortBy]);

  function clearFilters() {
    playClickSound();
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setTypeFilter("all");
    setSortBy("date-desc");
  }

  const hasFilters =
    search !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    typeFilter !== "all" ||
    sortBy !== "date-desc";

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-hero-grad-a to-hero-grad-b px-4 py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-200 border-t-brand-blue-600" />
          <p className="text-ink-500 text-sm font-semibold">Verifying administration authorization…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 bg-gradient-to-b from-hero-grad-a to-hero-grad-b px-4 py-12 text-ink-700 font-sans">
      {/* Decorative moving gradient blobs */}
      <div className="absolute top-12 left-1/4 h-[250px] w-[250px] rounded-full bg-brand-blue-200/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-12 right-1/4 h-[250px] w-[250px] rounded-full bg-brand-blue-300/15 blur-[120px] pointer-events-none" />

      <div className="z-10 flex items-center justify-between border-b border-surface-200 pb-5">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
            Management Panel
          </h1>
          <p className="text-xs font-semibold text-ink-500 mt-1">
            StartupLab Administrative Audit System {IS_MOCK && "• Demo Mode"}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Link
            href="/"
            onClick={playClickSound}
            className="text-xs font-bold text-ink-500 hover:text-brand-blue-600 transition"
          >
            ← Back to Kiosk
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-xs font-bold text-ink-700 hover:bg-brand-blue-50 hover:text-brand-blue-600 hover:border-brand-blue-200 transition shadow-sm cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="z-10 flex border-b border-surface-200">
        <button
          onClick={() => { playClickSound(); setActiveTab("attendance"); }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition ${activeTab === "attendance" ? "border-brand-blue-600 text-brand-blue-600" : "border-transparent text-ink-500 hover:text-ink-700"}`}
        >
          📁 Attendance Database
        </button>
        <button
          onClick={() => { playClickSound(); setActiveTab("security"); }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition ${activeTab === "security" ? "border-brand-blue-600 text-brand-blue-600" : "border-transparent text-ink-500 hover:text-ink-700"}`}
        >
          🛡️ Administrative Security Audits
        </button>
      </div>

      {loading && activeTab === "attendance" && (
        <p className="text-ink-500 text-sm font-semibold">Loading attendance logs database…</p>
      )}

      {error && (
        <p className="rounded-xl bg-brand-blue-50 border border-brand-blue-200 px-4 py-3 text-sm font-bold text-brand-blue-700">
          ⚠️ {error}
        </p>
      )}

      {!loading && !error && activeTab === "attendance" && (
        <>
          {/* Filters & sorting */}
          <div className="z-10 flex flex-col gap-4 rounded-[18px] border border-surface-200 bg-white p-5 shadow-[0_12px_30px_-10px_rgba(49,94,239,0.08)]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="search" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">
                  Search name
                </label>
                <input
                  id="search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. Alex"
                  className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 placeholder-ink-400 outline-none transition focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500/20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="type" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">
                  Type
                </label>
                <select
                  id="type"
                  value={typeFilter}
                  onChange={(e) => { playClickSound(); setTypeFilter(e.target.value as TypeFilter); }}
                  className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500 cursor-pointer"
                >
                  <option value="all">All types</option>
                  <option value="login">Log In</option>
                  <option value="break">Break</option>
                  <option value="logout">Log Out</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="from" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">
                  From date
                </label>
                <input
                  id="from"
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500 [color-scheme:light]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="to" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">
                  To date
                </label>
                <input
                  id="to"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500 [color-scheme:light]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="sort" className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">
                  Sort by
                </label>
                <select
                  id="sort"
                  value={sortBy}
                  onChange={(e) => { playClickSound(); setSortBy(e.target.value as SortKey); }}
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
                {visibleLogs.length} of {logs.length} entries matching search query
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-brand-blue-600 hover:text-brand-blue-500 font-bold transition"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>

          {logs.length === 0 ? (
            <p className="z-10 text-ink-500 text-sm font-semibold">No entries recorded in database yet.</p>
          ) : visibleLogs.length === 0 ? (
            <p className="z-10 text-ink-500 text-sm font-semibold">No entries match your dashboard filters.</p>
          ) : (
            <div className="z-10 overflow-hidden rounded-[18px] border border-surface-200 bg-white shadow-[0_8px_20px_-8px_rgba(49,94,239,0.05)] animate-fadeIn">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="bg-surface-50 text-ink-500 border-b border-surface-200">
                  <tr>
                    <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs">Photo</th>
                    <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs">Name</th>
                    <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs">Role</th>
                    <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs">Action</th>
                    <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs">Streak / Badges</th>
                    <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs">Time</th>
                    <th className="px-5 py-4 font-bold uppercase tracking-wider text-right text-xs">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {visibleLogs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => { playClickSound(); setSelectedLog(log); }}
                      className="cursor-pointer transition hover:bg-brand-blue-50/20"
                    >
                      <td className="px-5 py-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={log.image_url}
                          alt={log.name}
                          className="h-11 w-11 rounded-xl object-cover border border-surface-200 bg-surface-50"
                        />
                      </td>
                      <td className="px-5 py-3 font-bold text-ink-900">
                        {log.name}
                      </td>
                      <td className="px-5 py-3 text-ink-600 capitalize font-medium">
                        {log.role || "intern"}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${TYPE_BADGE[log.type]}`}>
                          {TYPE_LABEL[log.type]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const streak = calculateStreak(logs, log.name);
                            const badges: string[] = [];

                            // Check time-based dynamic achievements
                            const logDate = new Date(log.created_at);
                            const hours = logDate.getHours();
                            if (log.type === "login" && hours < 9) {
                              badges.push("🌅 Early Bird");
                            } else if (log.type === "logout" && hours >= 18) {
                              badges.push("🌃 Night Owl");
                            }

                            return (
                              <>
                                {streak > 0 && log.type === "login" && (
                                  <span className="rounded-full bg-brand-blue-50 border border-brand-blue-200 px-2.5 py-0.5 text-[9px] font-bold text-brand-blue-700 uppercase tracking-wide">
                                    🔥 {streak}d Streak
                                  </span>
                                )}
                                {badges.map((badge, bIdx) => (
                                  <span key={bIdx} className="rounded-full bg-brand-blue-50/50 border border-brand-blue-100 px-2.5 py-0.5 text-[9px] font-bold text-brand-blue-600 uppercase tracking-wide">
                                    {badge}
                                  </span>
                                ))}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-ink-500 font-medium">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playClickSound();
                            setSelectedLog(log);
                          }}
                          aria-label={`View ${log.name}'s entry`}
                          className="inline-flex rounded-xl p-2 text-ink-400 transition hover:bg-surface-100 hover:text-brand-blue-600"
                        >
                          <EyeIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Security Tab view */}
      {activeTab === "security" && (
        <div className="z-10 flex flex-col gap-4">
          {securityLoading ? (
            <p className="text-ink-500 text-sm font-semibold">Loading security activities...</p>
          ) : securityLogs.length === 0 ? (
            <p className="text-ink-500 text-sm font-semibold">No security audits found.</p>
          ) : (
            <div className="overflow-hidden rounded-[18px] border border-surface-200 bg-white shadow-[0_8px_20px_-8px_rgba(49,94,239,0.05)] animate-fadeIn">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="bg-surface-50 text-ink-500 border-b border-surface-200">
                  <tr>
                    <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs">Timestamp</th>
                    <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs">Operation</th>
                    <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {securityLogs.map((audit) => (
                    <tr key={audit.id} className="hover:bg-brand-blue-50/10">
                      <td className="px-5 py-3.5 text-ink-500 font-medium">
                        {new Date(audit.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                          audit.action === "SIGN_IN" ? "bg-brand-blue-50 text-brand-blue-700 border-brand-blue-200" :
                          audit.action === "SIGN_IN" ? "bg-brand-blue-50 text-brand-blue-700 border-brand-blue-200" :
                          audit.action === "FAILED_SIGN_IN" ? "bg-brand-blue-50 text-brand-blue-700 border-brand-blue-200" :
                          "bg-brand-blue-50 text-brand-blue-700 border-brand-blue-200"
                        }`}>
                          {audit.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-ink-900 font-medium">
                        {audit.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedLog && (
        <LogModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </main>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LogModal({
  log,
  onClose,
}: {
  log: LogEntry;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-blue-950/40 p-4 backdrop-blur-sm animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-[18px] border border-surface-200 bg-white shadow-2xl animate-scaleIn"
      >
        <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Log Entry Details</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-1 text-ink-400 hover:bg-surface-100 hover:text-brand-blue-600 transition cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={log.image_url}
          alt={log.name}
          className="max-h-[50vh] w-full object-contain bg-surface-50 border-b border-surface-200"
        />

        <dl className="grid grid-cols-3 gap-y-3 px-5 py-5 text-xs sm:text-sm">
          <dt className="font-bold text-ink-500 uppercase tracking-wider">Name</dt>
          <dd className="col-span-2 font-bold text-ink-900">{log.name}</dd>

          <dt className="font-bold text-ink-500 uppercase tracking-wider">Role</dt>
          <dd className="col-span-2 text-ink-600 capitalize font-medium">{log.role || "intern"}</dd>

          <dt className="font-bold text-ink-500 uppercase tracking-wider">Action</dt>
          <dd className="col-span-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TYPE_BADGE[log.type]}`}>
              {TYPE_LABEL[log.type]}
            </span>
          </dd>

          <dt className="font-bold text-ink-500 uppercase tracking-wider">Time</dt>
          <dd className="col-span-2 text-ink-600 font-medium">
            {new Date(log.created_at).toLocaleString()}
          </dd>
        </dl>
      </div>
    </div>
  );
}
