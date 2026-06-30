"use client";

import { useEffect, useState } from "react";
import { calculateStreak } from "@/lib/logs";
import type { LogEntry, LogType } from "@/lib/supabase";
import { playClickSound } from "@/lib/audio";
import Pagination from "./Pagination";

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

interface AttendanceTableProps {
  logs: LogEntry[];
  visibleLogs: LogEntry[];
  loading: boolean;
  onSelectLog: (log: LogEntry) => void;
}

export default function AttendanceTable({ logs, visibleLogs, loading, onSelectLog }: AttendanceTableProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(visibleLogs.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedLogs = visibleLogs.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return <p className="text-ink-500 text-sm font-semibold">Loading attendance logs database…</p>;
  }

  if (logs.length === 0) {
    return <p className="z-10 text-ink-500 text-sm font-semibold">No entries recorded in database yet.</p>;
  }

  if (visibleLogs.length === 0) {
    return <p className="z-10 text-ink-500 text-sm font-semibold">No entries match your dashboard filters.</p>;
  }

  return (
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
          {paginatedLogs.map((log) => (
            <tr
              key={log.id}
              onClick={() => { playClickSound(); onSelectLog(log); }}
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
                    onSelectLog(log);
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
      <Pagination
        currentPage={page}
        totalItems={visibleLogs.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  );
}
