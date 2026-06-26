"use client";

import { useEffect, useState } from "react";
import CameraCapture from "./CameraCapture";
import { calculateStreak, createMultipleLogs, getLogs, getNameSuggestions } from "@/lib/logs";
import { IS_MOCK, type LogEntry, type LogType, type UserRole } from "@/lib/supabase";
import { playClickSound, playErrorSound, playSuccessSound } from "@/lib/audio";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success"; message: string; welcomeCards: Array<{ name: string; welcomeMessage: string; badges: Array<{ name: string; icon: string; style: string }> }> }
  | { kind: "error"; message: string };

const ACTION_LABEL: Record<LogType, string> = {
  login: "Log In",
  logout: "Log Out",
  break: "Break",
};

const ACTION_GRADIENT: Record<LogType, string> = {
  login: "from-brand-blue-600 to-brand-blue-500 shadow-brand-blue-100 hover:from-brand-blue-500 hover:to-brand-blue-400",
  logout: "from-brand-blue-600 to-brand-blue-500 shadow-brand-blue-100 hover:from-brand-blue-500 hover:to-brand-blue-400",
  break: "from-brand-blue-500 to-brand-blue-400 shadow-brand-blue-100 hover:from-brand-blue-400 hover:to-brand-blue-300",
};

const ACTION_BADGE: Record<LogType, string> = {
  login: "bg-brand-blue-50 border border-brand-blue-200 text-brand-blue-700",
  logout: "bg-brand-blue-50 border border-brand-blue-200 text-brand-blue-700",
  break: "bg-brand-blue-50 border border-brand-blue-200 text-brand-blue-700",
};

const ROLES: Array<{ value: UserRole; label: string }> = [
  { value: "intern", label: "Intern" },
  { value: "staff", label: "Staff" },
  { value: "guest", label: "Guest" },
  { value: "client", label: "Client" },
  { value: "admin", label: "Admin" },
];

const GREETINGS = [
  "🚀 Ready to build something amazing today?",
  "💡 Great products are made one check-in at a time!",
  "🔥 Innovation and passion fuel our growth here!",
  "🌟 Welcome back, builder! Let's crush today's goals!",
  "⚡ Stand out, build fast, and stay curious!",
  "🧠 Work hard, collaborate, and make an impact!",
];

export default function LogForm() {
  const [action, setAction] = useState<LogType | null>(null);
  const [people, setPeople] = useState<Array<{ name: string; role: UserRole }>>([{ name: "", role: "intern" }]);
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; role: UserRole }>>([]);
  const [activeInputIdx, setActiveInputIdx] = useState<number | null>(null);
  const [currentGreeting, setCurrentGreeting] = useState("");

    const greetingMatch = currentGreeting.match(/^([^\w\s]+)?\s*(.*)$/);
  const greetingEmoji = greetingMatch ? greetingMatch[1] : "";
  const greetingText = greetingMatch ? greetingMatch[2] : currentGreeting;

  useEffect(() => {
    setCurrentGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  }, [action]);

  useEffect(() => {
    getLogs(500)
      .then(setAllLogs)
      .catch((error) => console.error("Failed to load logs:", error));

    getNameSuggestions()
      .then(setSuggestions)
      .catch((error) => console.error("Failed to load suggestions:", error));
  }, [action]);

  const saving = status.kind === "saving";
  const canSave = !!action && !!image && people.every((person) => person.name.trim().length > 0) && !saving;
  const actionLabel = action ? ACTION_LABEL[action] : "";

  function chooseAction(type: LogType) {
    playClickSound();
    setAction(type);
    setStatus({ kind: "idle" });
  }

  function reset() {
    playClickSound();
    setAction(null);
    setPeople([{ name: "", role: "intern" }]);
    setImage(null);
    setStatus({ kind: "idle" });
  }

  function addPerson() {
    playClickSound();
    setPeople((current) => [...current, { name: "", role: "intern" }]);
  }

  function removePerson(index: number) {
    playClickSound();
    setPeople((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function updatePersonName(index: number, value: string) {
    setPeople((current) => current.map((person, currentIndex) => (currentIndex === index ? { ...person, name: value } : person)));
  }

  function updatePersonRole(index: number, role: UserRole) {
    playClickSound();
    setPeople((current) => current.map((person, currentIndex) => (currentIndex === index ? { ...person, role } : person)));
  }

  function selectSuggestion(index: number, suggestion: { name: string; role: UserRole }) {
    playClickSound();
    setPeople((current) => current.map((person, currentIndex) => (currentIndex === index ? { name: suggestion.name, role: suggestion.role } : person)));
    setActiveInputIdx(null);
  }

  async function handleSave() {
    if (!canSave || !action || !image) return;

    setStatus({ kind: "saving" });

    try {
      const createdLogs = await createMultipleLogs(people, action, image);
      const updatedLogs = [...createdLogs, ...allLogs];
      setAllLogs(updatedLogs);

      const welcomeCards = people.map((person) => {
        const name = person.name.trim();
        const badges: Array<{ name: string; icon: string; style: string }> = [];
        const streak = calculateStreak(updatedLogs, name);

        const welcomeMessage =
          action === "login"
            ? `Good to see you, ${name}! Let's write some beautiful code today. 🚀`
            : action === "break"
              ? `Enjoy your break, ${name}! Go grab a hot drink and relax. ☕`
              : `Great work today, ${name}! Rest up and have a relaxing evening. 🌙`;

        if (streak >= 5 || streak >= 3) {
          badges.push({
            name: `${streak}-Day Streak`,
            icon: "🔥",
            style: "bg-brand-blue-50 border border-brand-blue-200 text-brand-blue-700",
          });
        } else if (streak > 0 && action === "login") {
          badges.push({
            name: `${streak}d Streak`,
            icon: "⚡",
            style: "bg-brand-blue-50 border border-brand-blue-200 text-brand-blue-700",
          });
        }

        const hour = new Date().getHours();
        if (action === "login" && hour < 9) {
          badges.push({
            name: "Early Bird",
            icon: "🌅",
            style: "bg-brand-blue-50 border border-brand-blue-200 text-brand-blue-700",
          });
        }

        if (action === "logout" && hour >= 18) {
          badges.push({
            name: "Night Owl",
            icon: "🌃",
            style: "bg-brand-blue-50 border border-brand-blue-200 text-brand-blue-700",
          });
        }

        if (people.length > 1) {
          badges.push({
            name: "Team Player",
            icon: "👥",
            style: "bg-brand-blue-50 border border-brand-blue-200 text-brand-blue-700",
          });
        }

        return { name, welcomeMessage, badges };
      });

      playSuccessSound();
      setStatus({
        kind: "success",
        message: action === "login" ? "Logged In Successfully!" : action === "break" ? "Break Logged!" : "Logged Out Successfully!",
        welcomeCards,
      });

      setTimeout(reset, 5000);
    } catch (error) {
      playErrorSound();
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }

  if (!action) {
    return (
      <div className="flex w-full max-w-xl flex-col gap-6 rounded-[18px] border border-surface-200 bg-white p-6 shadow-[0_12px_30px_-10px_rgba(49,94,239,0.08)] animate-scaleIn">
        <div className="mx-auto rounded-full bg-brand-blue-50 border border-brand-blue-200 px-3 py-1 text-[11px] font-semibold text-brand-blue-700 tracking-wide shadow-sm">
          {IS_MOCK ? "⚠️ Running in Local Demo Mode" : "⚡ Live Database Connected"}
        </div>

        {currentGreeting && (
          <div className="relative overflow-hidden rounded-2xl bg-white border border-surface-200/80 px-6 py-5 text-center shadow-[0_8px_30px_rgba(49,94,239,0.03)] animate-scaleIn flex flex-col items-center justify-center gap-1.5 select-none">
            <div className="absolute top-2.5 left-3.5 text-brand-blue-600/30 animate-pulse">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
              </svg>
            </div>
            <div className="absolute bottom-2.5 right-3.5 text-brand-blue-400/30 animate-pulse delay-100">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
              </svg>
            </div>

            {greetingEmoji && <span className="mb-1 animate-bounce text-3xl drop-shadow-sm">{greetingEmoji}</span>}
            <p className="font-slogan select-none bg-gradient-to-r from-brand-blue-600 via-brand-blue-500 to-brand-blue-300 bg-clip-text py-1 text-2xl font-black leading-snug tracking-wide text-transparent md:text-3.5xl">
              {greetingText}
            </p>
          </div>
        )}

        <p className="text-center text-xs font-bold uppercase tracking-wider text-ink-400">Choose Session Action</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button type="button" onClick={() => chooseAction("login")} className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-brand-blue-100 bg-brand-blue-50/30 px-4 py-8 text-center shadow-sm transition duration-200 hover:scale-102 hover:bg-brand-blue-50 active:scale-98">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue-500 text-white shadow-md shadow-brand-blue-100 transition group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            </div>
            <span className="text-base font-extrabold text-ink-900">Log In</span>
            <span className="text-xs font-medium text-ink-500">Start shift</span>
          </button>

          <button type="button" onClick={() => chooseAction("break")} className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-brand-blue-100 bg-brand-blue-50/30 px-4 py-8 text-center shadow-sm transition duration-200 hover:scale-102 hover:bg-brand-blue-50 active:scale-98">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue-500 text-white shadow-md shadow-brand-blue-100 transition group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="9" x2="9" y2="15"/><line x1="15" y1="9" x2="15" y2="15"/></svg>
            </div>
            <span className="text-base font-extrabold text-ink-900">Take Break</span>
            <span className="text-xs font-medium text-ink-500">Pause tracking</span>
          </button>

          <button type="button" onClick={() => chooseAction("logout")} className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-brand-blue-100 bg-brand-blue-50/30 px-4 py-8 text-center shadow-sm transition duration-200 hover:scale-102 hover:bg-brand-blue-50 active:scale-98">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue-500 text-white shadow-md shadow-brand-blue-100 transition group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </div>
            <span className="text-base font-extrabold text-ink-900">Log Out</span>
            <span className="text-xs font-medium text-ink-500">Finish shift</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-6 rounded-[18px] border border-surface-200 bg-white p-6 shadow-[0_12px_30px_-10px_rgba(49,94,239,0.08)] animate-scaleIn">
      <div className="flex items-center justify-between border-b border-surface-100 pb-4">
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${ACTION_BADGE[action]}`}>{actionLabel}</span>
        <button type="button" onClick={reset} disabled={saving} className="cursor-pointer text-xs font-bold text-ink-500 transition hover:text-brand-blue-600 disabled:opacity-30">
          ← Change Action
        </button>
      </div>

      {status.kind === "success" ? (
        <div className="flex flex-col gap-5 rounded-2xl border border-brand-blue-100 bg-gradient-to-b from-brand-blue-50/40 to-brand-blue-100/10 p-6 text-center shadow-inner animate-scaleIn">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-brand-blue-600 to-brand-blue-500 text-xl font-bold text-white shadow-md shadow-brand-blue-100">✨</div>
          <div>
            <h3 className="font-display text-xl font-extrabold text-ink-900">{status.message}</h3>
            <p className="mt-1 text-xs font-medium text-ink-500">Logged successfully in StartupLab database</p>
          </div>

          <div className="mt-2 flex flex-col gap-4 border-t border-surface-200/50 pt-5 text-left">
            {status.welcomeCards.map((card, index) => (
              <div key={index} className="flex flex-col gap-2.5 rounded-2xl border border-surface-200 bg-white p-4 shadow-sm animate-scaleIn">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink-900">{card.name}</span>
                  <span className="rounded-full border border-brand-blue-200/50 bg-brand-blue-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-blue-600">Unlocked</span>
                </div>
                <p className="text-xs leading-relaxed italic text-ink-600">"{card.welcomeMessage}"</p>
                {card.badges.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5 border-t border-surface-100 pt-1.5">
                    {card.badges.map((badge, badgeIndex) => (
                      <span key={badgeIndex} className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge.style}`}>
                        <span>{badge.icon}</span>
                        <span>{badge.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-semibold text-ink-400 animate-pulse">
            <div className="h-1.5 w-1.5 rounded-full bg-brand-blue-600" />
            Loading new logging session...
          </div>
        </div>
      ) : (
        <>
          {currentGreeting && (
            <div className="relative flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-surface-200/60 bg-white px-4 py-3 text-center select-none shadow-sm">
              {greetingEmoji && <span className="text-xl animate-pulse">{greetingEmoji}</span>}
              <span className="font-slogan bg-gradient-to-r from-brand-blue-600 via-brand-blue-500 to-brand-blue-300 bg-clip-text text-base font-black tracking-wide text-transparent md:text-lg">
                {greetingText}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-500">Session Colleagues</label>
              <button type="button" onClick={addPerson} disabled={saving} className="cursor-pointer text-xs font-extrabold text-brand-blue-600 transition hover:text-brand-blue-500">
                ➕ Add Friend
              </button>
            </div>

            {people.map((person, index) => {
              const streak = calculateStreak(allLogs, person.name);
              const filteredSuggestions = person.name.trim().length === 0
                ? suggestions.slice(0, 10)
                : suggestions.filter((suggestion) => suggestion.name.toLowerCase().includes(person.name.toLowerCase()) && suggestion.name.toLowerCase() !== person.name.toLowerCase());

              return (
                <div key={index} className="relative flex flex-col gap-2 rounded-2xl border border-brand-blue-100 bg-brand-blue-50/20 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="relative flex-1">
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-500">Name</label>
                      <input
                        type="text"
                        value={person.name}
                        onFocus={() => setActiveInputIdx(index)}
                        onBlur={() => setTimeout(() => setActiveInputIdx(null), 250)}
                        onChange={(event) => updatePersonName(index, event.target.value)}
                        placeholder="e.g. Alex"
                        disabled={saving}
                        className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 placeholder-ink-400 outline-none transition focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500/20"
                      />

                      {activeInputIdx === index && filteredSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-48 overflow-y-auto rounded-xl border border-surface-200 bg-white shadow-lg">
                          {filteredSuggestions.map((suggestion, suggestionIndex) => (
                            <button key={suggestionIndex} type="button" onClick={() => selectSuggestion(index, suggestion)} className="flex w-full cursor-pointer items-center justify-between border-b border-surface-100 px-3 py-2.5 text-left text-xs font-medium transition hover:bg-brand-blue-50 hover:text-brand-blue-600 last:border-0">
                              <span className="font-bold text-ink-900">{suggestion.name}</span>
                              <span className="rounded bg-brand-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase text-brand-blue-500">{suggestion.role}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="w-[120px]">
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-500">Role</label>
                      <select
                        value={person.role}
                        onChange={(event) => updatePersonRole(index, event.target.value as UserRole)}
                        disabled={saving}
                        className="w-full cursor-pointer rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500"
                      >
                        {ROLES.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removePerson(index)}
                        disabled={saving}
                        title="Remove person"
                        className="mt-6 cursor-pointer rounded-xl p-2 text-ink-400 transition hover:bg-brand-blue-50 hover:text-brand-blue-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="12"/></svg>
                      </button>
                    )}
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

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-ink-500">Webcam Verification</label>
            <CameraCapture onCapture={setImage} />
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full rounded-xl bg-gradient-to-r ${ACTION_GRADIENT[action]} cursor-pointer py-4 font-bold text-white shadow-md transition duration-200 active:scale-98 disabled:cursor-not-allowed disabled:opacity-30`}
          >
            {saving ? "Logging session details…" : `Save & Complete ${actionLabel}`}
          </button>

          {status.kind === "error" && (
            <p className="rounded-xl border border-brand-blue-200 bg-brand-blue-50 px-4 py-3 text-center text-xs font-bold text-brand-blue-700 animate-fadeIn">
              ⚠️ {status.message}
            </p>
          )}

          <div className="flex items-center justify-center gap-2 border-t border-surface-100 pt-4 text-center text-[10px] font-semibold text-ink-400">
            🔒 Data Privacy Compliant: Photos are processed locally for security logs and are never shared.
          </div>
        </>
      )}
    </div>
  );
}
