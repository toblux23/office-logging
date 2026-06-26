"use client";

import { useState, useEffect } from "react";
import CameraCapture from "./CameraCapture";
import { createMultipleLogs, getLogs, getNameSuggestions, calculateStreak } from "@/lib/logs";
import { IS_MOCK, type LogType, type UserRole, type LogEntry } from "@/lib/supabase";
import { playClickSound, playSuccessSound, playErrorSound } from "@/lib/audio";

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
  login: "from-emerald-600 to-teal-500 shadow-emerald-100 hover:from-emerald-500 hover:to-teal-400",
  logout: "from-rose-600 to-red-500 shadow-rose-100 hover:from-rose-500 hover:to-red-400",
  break: "from-amber-500 to-orange-500 shadow-amber-100 hover:from-amber-400 hover:to-orange-400",
};

const ACTION_BADGE: Record<LogType, string> = {
  login: "bg-emerald-50 border border-emerald-200 text-emerald-700",
  logout: "bg-rose-50 border border-rose-200 text-rose-700",
  break: "bg-amber-50 border border-amber-200 text-amber-700",
};

const ROLES: Array<{ value: UserRole; label: string }> = [
  { value: "intern", label: "Intern" },
  { value: "staff", label: "Staff" },
  { value: "guest", label: "Guest" },
  { value: "client", label: "Client" },
  { value: "admin", label: "Admin" },
];

const MOTIVATIONAL_GREETINGS = [
  "🚀 Ready to build something amazing today?",
  "💡 Great products are made one check-in at a time!",
  "🔥 Innovation and passion fuel our growth here!",
  "🌟 Welcome back, builder! Let's crush today's goals!",
  "⚡ Stand out, build fast, and stay curious!",
  "🧠 Work hard, collaborate, and make an impact!"
];

export default function LogForm() {
  const [action, setAction] = useState<LogType | null>(null);
  const [people, setPeople] = useState<Array<{ name: string; role: UserRole }>>([
    { name: "", role: "intern" },
  ]);
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; role: UserRole }>>([]);
  const [activeInputIdx, setActiveInputIdx] = useState<number | null>(null);
  const [currentGreeting, setCurrentGreeting] = useState("");

  // Extract emoji and text from currentGreeting for slogan typography styling
  const match = currentGreeting.match(/^([^\w\s]+)\s*(.*)$/);
  const greetingEmoji = match ? match[1] : "";
  const greetingText = match ? match[2] : currentGreeting;

  // Select a random greeting when component mounts
  useEffect(() => {
    const randomIdx = Math.floor(Math.random() * MOTIVATIONAL_GREETINGS.length);
    setCurrentGreeting(MOTIVATIONAL_GREETINGS[randomIdx]);
  }, [action]);

  // Load baseline logs and suggestions
  useEffect(() => {
    getLogs(500)
      .then(setAllLogs)
      .catch((e) => console.error("Failed to load logs:", e));

    getNameSuggestions()
      .then(setSuggestions)
      .catch((e) => console.error("Failed to load suggestions:", e));
  }, [action]);

  const saving = status.kind === "saving";
  const hasValidNames = people.every((p) => p.name.trim().length > 0);
  const canSave = hasValidNames && !!image && !saving;
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
    setPeople([...people, { name: "", role: "intern" }]);
  }

  function removePerson(idx: number) {
    playClickSound();
    const copy = [...people];
    copy.splice(idx, 1);
    setPeople(copy);
  }

  function updatePersonName(idx: number, val: string) {
    const copy = [...people];
    copy[idx].name = val;
    setPeople(copy);
  }

  function updatePersonRole(idx: number, role: UserRole) {
    playClickSound();
    const copy = [...people];
    copy[idx].role = role;
    setPeople(copy);
  }

  function selectSuggestion(idx: number, suggested: { name: string; role: UserRole }) {
    playClickSound();
    const copy = [...people];
    copy[idx].name = suggested.name;
    copy[idx].role = suggested.role;
    setPeople(copy);
    setActiveInputIdx(null);
  }

  async function handleSave() {
    if (!canSave || !action) return;
    setStatus({ kind: "saving" });
    try {
      const createdLogs = await createMultipleLogs(people, action, image!);
      const updatedLogs = [...createdLogs, ...allLogs];
      setAllLogs(updatedLogs);

      const welcomeCards = people.map((person) => {
        const badges: Array<{ name: string; icon: string; style: string }> = [];
        const streak = calculateStreak(updatedLogs, person.name);
        const namePart = person.name.trim();

        // 1. Personalized Welcome/Goodbye Quotes
        let welcomeMessage = "";
        if (action === "login") {
          const loginGreetings = [
            `Good to see you, ${namePart}! Let's write some beautiful code today. 🚀`,
            `Welcome back, ${namePart}! Ready to launch some features? 💡`,
            `Hello ${namePart}! Have an amazing, highly productive shift! ⚡`
          ];
          welcomeMessage = loginGreetings[Math.floor(Math.random() * loginGreetings.length)];
        } else if (action === "break") {
          welcomeMessage = `Enjoy your break, ${namePart}! Go grab a hot drink and relax. ☕`;
        } else {
          welcomeMessage = `Great work today, ${namePart}! Rest up and have a relaxing evening. 🌙`;
        }

        // 2. Achievements & Badges mapping (Clean light design)
        if (streak >= 5) {
          badges.push({
            name: `${streak}-Day Streak`,
            icon: "🔥",
            style: "bg-rose-50 border border-rose-200 text-rose-700"
          });
        } else if (streak >= 3) {
          badges.push({
            name: `${streak}-Day Streak`,
            icon: "🔥",
            style: "bg-orange-50 border border-orange-200 text-orange-700"
          });
        } else if (streak > 0 && action === "login") {
          badges.push({
            name: `${streak}d Streak`,
            icon: "⚡",
            style: "bg-brand-blue-50 border border-brand-blue-200 text-brand-blue-700"
          });
        }

        // Early Bird login
        const now = new Date();
        const hour = now.getHours();
        if (action === "login" && hour < 9) {
          badges.push({
            name: "Early Bird",
            icon: "🌅",
            style: "bg-amber-50 border border-amber-200 text-amber-700"
          });
        }

        // Night Owl logout
        if (action === "logout" && hour >= 18) {
          badges.push({
            name: "Night Owl",
            icon: "🌃",
            style: "bg-indigo-50 border border-indigo-200 text-indigo-700"
          });
        }

        // Teamwork badge
        if (people.length > 1) {
          badges.push({
            name: "Team Player",
            icon: "👥",
            style: "bg-cyan-50 border border-cyan-200 text-cyan-700"
          });
        }

        return { name: namePart, welcomeMessage, badges };
      });

      playSuccessSound();

      setStatus({
        kind: "success",
        message: action === "login" ? "Logged In Successfully!" : action === "break" ? "Break Logged!" : "Logged Out Successfully!",
        welcomeCards
      });

      setTimeout(reset, 5000);
    } catch (err) {
      playErrorSound();
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  // ---- Step 1: Choose Log In, Break, or Log Out ----
  if (!action) {
    return (
      <div className="flex w-full max-w-xl flex-col gap-6 rounded-[18px] border border-surface-200 bg-white p-6 shadow-[0_12px_30px_-10px_rgba(49,94,239,0.08)] animate-scaleIn">
        {/* Offline Demo Banner */}
        {IS_MOCK ? (
          <div className="mx-auto rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-semibold text-amber-700 tracking-wide shadow-sm">
            ⚠️ Running in Local Demo Mode
          </div>
        ) : (
          <div className="mx-auto rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-700 tracking-wide shadow-sm">
            ⚡ Live Database Connected
          </div>
        )}

        {/* Motivational Greeting Widget with Modern Bubbly Typography */}
        {currentGreeting && (
          <div className="relative overflow-hidden rounded-2xl bg-white border border-surface-200/80 px-6 py-5 text-center shadow-[0_8px_30px_rgba(49,94,239,0.03)] animate-scaleIn flex flex-col items-center justify-center gap-1.5 select-none">
            {/* Elegant floating 4-point stars/sparkles in matching theme colors */}
            <div className="absolute top-2.5 left-3.5 text-[#FF4081]/30 animate-pulse">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z"/>
              </svg>
            </div>
            <div className="absolute bottom-2.5 right-3.5 text-[#37BCF1]/30 animate-pulse delay-100">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z"/>
              </svg>
            </div>

            {greetingEmoji && (
              <span className="text-3xl filter drop-shadow-sm animate-bounce mb-1">
                {greetingEmoji}
              </span>
            )}
            
            <p className="font-slogan text-2xl md:text-3.5xl font-black bg-gradient-to-r from-[#315EEF] via-[#FF4081] to-[#FF4B2B] bg-clip-text text-transparent tracking-wide select-none leading-snug py-1">
              {greetingText}
            </p>
          </div>
        )}

        <p className="text-center text-xs font-bold tracking-wider text-ink-400 uppercase">
          Choose Session Action
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => chooseAction("login")}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/30 px-4 py-8 text-center transition duration-200 hover:scale-102 hover:bg-emerald-50 active:scale-98 cursor-pointer shadow-sm"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md transition group-hover:scale-110 shadow-emerald-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            </div>
            <span className="text-base font-extrabold text-ink-900">Log In</span>
            <span className="text-xs text-ink-500 font-medium">Start shift</span>
          </button>

          <button
            type="button"
            onClick={() => chooseAction("break")}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/30 px-4 py-8 text-center transition duration-200 hover:scale-102 hover:bg-amber-50 active:scale-98 cursor-pointer shadow-sm"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md transition group-hover:scale-110 shadow-amber-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="9" x2="9" y2="15"/><line x1="15" y1="9" x2="15" y2="15"/></svg>
            </div>
            <span className="text-base font-extrabold text-ink-900">Take Break</span>
            <span className="text-xs text-ink-500 font-medium">Pause tracking</span>
          </button>

          <button
            type="button"
            onClick={() => chooseAction("logout")}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/30 px-4 py-8 text-center transition duration-200 hover:scale-102 hover:bg-rose-50 active:scale-98 cursor-pointer shadow-sm"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500 text-white shadow-md transition group-hover:scale-110 shadow-rose-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </div>
            <span className="text-base font-extrabold text-ink-900">Log Out</span>
            <span className="text-xs text-ink-500 font-medium">Finish shift</span>
          </button>
        </div>
      </div>
    );
  }

  // ---- Step 2: Render Multi-person form and Webcam ----
  return (
    <div className="flex w-full max-w-xl flex-col gap-6 rounded-[18px] border border-surface-200 bg-white p-6 shadow-[0_12px_30px_-10px_rgba(49,94,239,0.08)] animate-scaleIn">
      <div className="flex items-center justify-between border-b border-surface-100 pb-4">
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${ACTION_BADGE[action]}`}>
          {actionLabel}
        </span>
        <button
          type="button"
          onClick={reset}
          disabled={saving}
          className="text-xs font-bold text-ink-500 hover:text-brand-blue-600 transition disabled:opacity-30 cursor-pointer"
        >
          ← Change Action
        </button>
      </div>

      {status.kind === "success" ? (
        <div className="flex flex-col gap-5 rounded-2xl bg-gradient-to-b from-brand-blue-50/40 to-brand-cyan/5 border border-brand-blue-100/50 p-6 text-center animate-scaleIn shadow-inner">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-brand-blue-600 to-brand-cyan text-white text-xl font-bold shadow-md shadow-brand-blue-100">
            ✨
          </div>
          <div>
            <h3 className="font-display text-xl font-extrabold text-ink-900">
              {status.message}
            </h3>
            <p className="text-xs text-ink-500 mt-1 font-medium">Logged successfully in StartupLab database</p>
          </div>
          
          <div className="flex flex-col gap-4 text-left border-t border-surface-200/50 pt-5 mt-2">
            {status.welcomeCards.map((card, index) => (
              <div
                key={index}
                className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm flex flex-col gap-2.5 animate-scaleIn"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink-900">{card.name}</span>
                  <span className="text-[9px] uppercase font-bold tracking-wider text-brand-blue-600 bg-brand-blue-50 px-2.5 py-0.5 rounded-full border border-brand-blue-200/50">Unlocked</span>
                </div>
                
                {/* Personalized Message */}
                <p className="text-xs text-ink-600 leading-relaxed italic">
                  "{card.welcomeMessage}"
                </p>

                {/* Achievements Badges list */}
                {card.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-surface-100 mt-1">
                    {card.badges.map((badge, bIdx) => (
                      <span
                        key={bIdx}
                        className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge.style}`}
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-ink-400 font-semibold animate-pulse">
            <div className="h-1.5 w-1.5 rounded-full bg-brand-blue-600" />
            Loading new logging session...
          </div>
        </div>
      ) : (
        <>
          {/* Motivational Greeting at head of details form with Modern Bubbly Typography */}
          {currentGreeting && (
            <div className="relative overflow-hidden rounded-xl border border-surface-200/60 bg-white px-4 py-3 text-center shadow-sm select-none flex items-center justify-center gap-2">
              {greetingEmoji && <span className="text-xl animate-pulse">{greetingEmoji}</span>}
              <span className="font-slogan text-base md:text-lg font-black bg-gradient-to-r from-[#315EEF] via-[#FF4081] to-[#FF4B2B] bg-clip-text text-transparent tracking-wide">
                {greetingText}
              </span>
            </div>
          )}

          {/* List of People in Log session */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold tracking-wider text-ink-500 uppercase">
                Session Colleagues
              </label>
              <button
                type="button"
                onClick={addPerson}
                disabled={saving}
                className="text-xs font-extrabold text-brand-blue-600 hover:text-brand-blue-500 transition cursor-pointer"
              >
                ➕ Add Friend
              </button>
            </div>

            {people.map((person, idx) => {
              const streak = calculateStreak(allLogs, person.name);
              const filteredSuggestions = person.name.trim().length === 0
                ? suggestions.slice(0, 10)
                : suggestions.filter(
                    (s) =>
                      s.name.toLowerCase().includes(person.name.toLowerCase()) &&
                      s.name.toLowerCase() !== person.name.toLowerCase()
                  );

              return (
                <div key={idx} className="relative flex flex-col gap-2 rounded-2xl border border-surface-200 bg-surface-50/50 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    {/* Name input */}
                    <div className="relative flex-1">
                      <label className="mb-1 block text-[10px] font-bold text-ink-500 uppercase tracking-wide">
                        Name
                      </label>
                      <input
                        type="text"
                        value={person.name}
                        onFocus={() => setActiveInputIdx(idx)}
                        onBlur={() => setTimeout(() => setActiveInputIdx(null), 250)}
                        onChange={(e) => updatePersonName(idx, e.target.value)}
                        placeholder="e.g. Alex"
                        disabled={saving}
                        className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 placeholder-ink-400 outline-none transition focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500/20"
                      />

                      {/* Autocomplete Suggestions Box */}
                      {activeInputIdx === idx && filteredSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-48 overflow-y-auto rounded-xl border border-surface-200 bg-white shadow-lg">
                          {filteredSuggestions.map((s, sIdx) => (
                            <button
                               key={sIdx}
                               type="button"
                               onClick={() => selectSuggestion(idx, s)}
                               className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs hover:bg-brand-blue-50 hover:text-brand-blue-600 transition border-b border-surface-100 last:border-0 cursor-pointer font-medium"
                            >
                              <span className="font-bold text-ink-900">{s.name}</span>
                              <span className="text-[9px] uppercase font-bold text-brand-blue-500 bg-brand-blue-50 px-2 py-0.5 rounded">{s.role}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Role selector dropdown */}
                    <div className="w-[120px]">
                      <label className="mb-1 block text-[10px] font-bold text-ink-500 uppercase tracking-wide">
                        Role
                      </label>
                      <select
                        value={person.role}
                        onChange={(e) => updatePersonRole(idx, e.target.value as UserRole)}
                        disabled={saving}
                        className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500 cursor-pointer"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Remove button */}
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => removePerson(idx)}
                        disabled={saving}
                        className="mt-6 rounded-xl p-2 text-ink-400 hover:bg-surface-200/50 hover:text-rose-500 transition cursor-pointer"
                        title="Remove person"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="12"/></svg>
                      </button>
                    )}
                  </div>

                  {/* Streak & welcome indicators */}
                  {person.name.trim().length > 0 && streak > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="rounded-full bg-brand-blue-50 border border-brand-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-brand-blue-600 animate-pulse">
                        🔥 {streak}-Day Streak Active
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Camera Capture Section */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold tracking-wider text-ink-500 uppercase">
              Webcam Verification
            </label>
            <CameraCapture onCapture={setImage} />
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full rounded-xl bg-gradient-to-r ${ACTION_GRADIENT[action]} py-4 font-bold text-white shadow-md transition duration-200 active:scale-98 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer`}
          >
            {saving
              ? "Logging session details…"
              : `Save & Complete ${actionLabel}`}
          </button>

          {/* Error notice */}
          {status.kind === "error" && (
            <p className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-center text-xs font-bold text-rose-700 animate-fadeIn">
              ⚠️ {status.message}
            </p>
          )}

          {/* Privacy statement */}
          <div className="flex items-center justify-center gap-2 text-center text-[10px] text-ink-400 font-semibold border-t border-surface-100 pt-4">
            🔒 Data Privacy Compliant: Photos are processed locally for security logs and are never shared.
          </div>
        </>
      )}
    </div>
  );
}
