"use client";

import { useEffect, useRef, useState } from "react";
import CameraCapture from "@/components/shared/CameraCapture";
import ActionSelector from "./ActionSelector";
import PersonForm from "./PersonForm";
import SessionGreeting from "./SessionGreeting";
import SuccessCard from "./SuccessCard";
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
  login: "from-emerald-600 to-emerald-500 shadow-action-login-light hover:from-emerald-500 hover:to-emerald-400",
  logout: "from-red-600 to-red-500 shadow-action-logout-light hover:from-red-500 hover:to-red-400",
  break: "from-amber-500 to-amber-400 shadow-action-break-light hover:from-amber-400 hover:to-amber-300",
};

const ACTION_BADGE: Record<LogType, string> = {
  login: "bg-action-login-bg border border-action-login-light text-action-login",
  logout: "bg-action-logout-bg border border-action-logout-light text-action-logout",
  break: "bg-action-break-bg border border-action-break-light text-action-break",
};

const GREETINGS = [
  "🚀 Ready to build something amazing today?",
  "💡 Great products are made one check-in at a time!",
  "🔥 Innovation and passion fuel our growth here!",
  "🌟 Welcome back, builder! Let's crush today's goals!",
  "⚡ Stand out, build fast, and stay curious!",
  "🧠 Work hard, collaborate, and make an impact!",
];

const MAX_PEOPLE = 4;
const WALK_IN_ROLES = new Set<UserRole>(["guest", "client"]);

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeRole(role: UserRole | string): string {
  return role.toLowerCase();
}

function mergeSuggestions(
  currentSuggestions: Array<{ name: string; role: UserRole }>,
  newSuggestions: Array<{ name: string; role: UserRole }>
) {
  const suggestionsByName = new Map<string, { name: string; role: UserRole }>();

  for (const suggestion of currentSuggestions) {
    suggestionsByName.set(normalizeName(suggestion.name), suggestion);
  }

  for (const suggestion of newSuggestions) {
    suggestionsByName.set(normalizeName(suggestion.name), suggestion);
  }

  return Array.from(suggestionsByName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getRoleVerificationError(
  people: Array<{ name: string; role: UserRole }>,
  suggestions: Array<{ name: string; role: UserRole }>,
  action: LogType
) {
  const suggestionsByName = new Map<string, { name: string; role: UserRole }>();

  for (const suggestion of suggestions) {
    suggestionsByName.set(normalizeName(suggestion.name), suggestion);
  }

  for (const person of people) {
    const name = person.name.trim();
    const registeredPerson = suggestionsByName.get(normalizeName(name));

    if (registeredPerson && normalizeRole(registeredPerson.role) === normalizeRole(person.role)) continue;
    if (!registeredPerson && action === "login" && WALK_IN_ROLES.has(person.role)) continue;

    if (registeredPerson) {
      return `${name} is registered as ${registeredPerson.role}, not ${person.role}. Please select the correct role.`;
    }

    return `${name} is not registered as ${person.role}. Contact an administrator.`;
  }

  return null;
}

export default function LogForm() {
  const [action, setAction] = useState<LogType | null>(null);
  const [people, setPeople] = useState<Array<{ name: string; role: UserRole }>>([{ name: "", role: "intern" }]);
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; role: UserRole }>>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
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
  }, [action]);

  useEffect(() => {
    getNameSuggestions()
      .then((loadedSuggestions) => {
        setSuggestions(loadedSuggestions);
        setSuggestionsLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to load suggestions:", error);
        setSuggestionsLoaded(false);
      });
  }, []);

  const saving = status.kind === "saving";
  const canSave = !!action && !!image && people.every((person) => person.name.trim().length > 0) && !saving;
  const actionLabel = action ? ACTION_LABEL[action] : "";
  const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function chooseAction(type: LogType) {
    playClickSound();
    setAction(type);
    setStatus({ kind: "idle" });
  }

  function reset() {
    if (autoResetRef.current) {
      clearTimeout(autoResetRef.current);
      autoResetRef.current = null;
    }
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
    setPeople((current) =>
      current.map((person, currentIndex) => {
        if (currentIndex !== index) return person;

        const selectedNameExistsForRole = suggestions.some(
          (suggestion) => normalizeRole(suggestion.role) === normalizeRole(role) && normalizeName(suggestion.name) === normalizeName(person.name)
        );

        return {
          ...person,
          role,
          name: person.name.trim().length === 0 || selectedNameExistsForRole ? person.name : "",
        };
      })
    );
  }

  function handleSelectSuggestion(index: number, suggestion: { name: string; role: UserRole }) {
    setPeople((current) => current.map((person, currentIndex) => (currentIndex === index ? { name: suggestion.name, role: suggestion.role } : person)));
  }

  async function handleSave() {
    if (!canSave || !action || !image) return;

    if (suggestionsLoaded) {
      const roleVerificationError = getRoleVerificationError(people, suggestions, action);
      if (roleVerificationError) {
        playErrorSound();
        setStatus({ kind: "error", message: roleVerificationError });
        return;
      }
    }

    setStatus({ kind: "saving" });

    try {
      const createdLogs = await createMultipleLogs(people, action, image);
      const updatedLogs = [...createdLogs, ...allLogs];
      setAllLogs(updatedLogs);
      setSuggestions((current) => mergeSuggestions(current, createdLogs.map(({ name, role }) => ({ name, role }))));

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

        if (streak >= 5) {
          badges.push({
            name: `${streak}-Day Streak`,
            icon: "🔥",
            style: "bg-brand-blue-50 border border-brand-blue-200 text-brand-blue-700",
          });
        } else if (streak >= 3) {
          badges.push({
            name: `${streak}-Day Streak`,
            icon: "⚡",
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

      autoResetRef.current = setTimeout(reset, 5000);
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
          <SessionGreeting emoji={greetingEmoji} text={greetingText} variant="hero" />
        )}

        <p className="text-center text-xs font-bold uppercase tracking-wider text-ink-400">Choose Session Action</p>

        <ActionSelector onSelect={chooseAction} />
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
        <SuccessCard message={status.message} welcomeCards={status.welcomeCards} />
      ) : (
        <>
          {currentGreeting && (
            <SessionGreeting emoji={greetingEmoji} text={greetingText} variant="inline" />
          )}

          <PersonForm
            people={people}
            allLogs={allLogs}
            suggestions={suggestions}
            saving={saving}
            maxPeople={MAX_PEOPLE}
            onUpdateName={updatePersonName}
            onUpdateRole={updatePersonRole}
            onRemove={removePerson}
            onAdd={addPerson}
            onSelectSuggestion={handleSelectSuggestion}
          />

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
