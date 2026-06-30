"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getLogs, getActivityLogs, createActivityLog, getNameSuggestions, getAdminConfig, getAdminList, deleteAdmin } from "@/lib/logs";
import { supabase, IS_MOCK } from "@/lib/supabase";
import type { LogEntry, LogType, UserRole, AdminActivityLog } from "@/lib/supabase";
import { playClickSound } from "@/lib/audio";
import FilterBar from "./FilterBar";
import AttendanceTable from "./AttendanceTable";
import SecurityAuditTable from "./SecurityAuditTable";
import LogDetailModal from "./LogDetailModal";
import UserRegistrationPanel from "./UserRegistrationPanel";
import AdminManagementPanel from "./AdminManagementPanel";

type SortKey = "date-desc" | "date-asc" | "name-asc" | "name-desc";
type TypeFilter = "all" | LogType;
type RoleFilter = "all" | UserRole;

export default function AdminDashboardPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"attendance" | "security" | "registration" | "admin-management">("attendance");
  const [securityLogs, setSecurityLogs] = useState<AdminActivityLog[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("date-desc");
  const [nameSuggestions, setNameSuggestions] = useState<Array<{ name: string; role: UserRole }>>([]);

  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

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
      getNameSuggestions().then(setNameSuggestions).catch(() => {});
    } else {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) {
          router.replace("/login");
          return;
        }

        const config = await getAdminConfig(session.user.email).catch(() => null);
        if (!config) {
          await supabase.auth.signOut();
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
        getNameSuggestions().then(setNameSuggestions).catch(() => {});
      });
    }
  }, [router]);

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
      if (roleFilter !== "all" && log.role !== roleFilter) return false;
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
  }, [logs, search, dateFrom, dateTo, typeFilter, roleFilter, sortBy]);

  function clearFilters() {
    playClickSound();
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setTypeFilter("all");
    setRoleFilter("all");
    setSortBy("date-desc");
  }

  const hasFilters =
    search !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    typeFilter !== "all" ||
    roleFilter !== "all" ||
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
        <button
          onClick={() => { playClickSound(); setActiveTab("registration"); }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition ${activeTab === "registration" ? "border-brand-blue-600 text-brand-blue-600" : "border-transparent text-ink-500 hover:text-ink-700"}`}
        >
          👤 User Registration
        </button>
        <button
          onClick={() => { playClickSound(); setActiveTab("admin-management"); }}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition ${activeTab === "admin-management" ? "border-brand-blue-600 text-brand-blue-600" : "border-transparent text-ink-500 hover:text-ink-700"}`}
        >
          🔐 Admin Management
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-brand-blue-50 border border-brand-blue-200 px-4 py-3 text-sm font-bold text-brand-blue-700">
          ⚠️ {error}
        </p>
      )}

      {activeTab === "attendance" && !error && (
        <>
          <FilterBar
            search={search}
            dateFrom={dateFrom}
            dateTo={dateTo}
            typeFilter={typeFilter}
            roleFilter={roleFilter}
            sortBy={sortBy}
            totalLogs={logs.length}
            visibleCount={visibleLogs.length}
            hasFilters={hasFilters}
            nameSuggestions={nameSuggestions}
            onSearchChange={setSearch}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onTypeFilterChange={setTypeFilter}
            onRoleFilterChange={setRoleFilter}
            onSortByChange={setSortBy}
            onClearFilters={clearFilters}
          />
          <AttendanceTable
            logs={logs}
            visibleLogs={visibleLogs}
            loading={loading}
            onSelectLog={setSelectedLog}
          />
        </>
      )}

      {activeTab === "security" && (
        <SecurityAuditTable logs={securityLogs} loading={securityLoading} />
      )}

      {activeTab === "registration" && (
        <UserRegistrationPanel />
      )}

      {activeTab === "admin-management" && (
        <AdminManagementPanel />
      )}

      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </main>
  );
}
