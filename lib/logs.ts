import { supabase, type LogEntry, type LogType, type UserRole, type AdminActivityLog, IS_MOCK } from "./supabase";

const BUCKET = "log-images";

/** Convert a base64 data URL (from the webcam) into a Blob for upload. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// Helper to interact with LocalStorage when IS_MOCK is true
function getMockLogs(): LogEntry[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("office_logs");
  let logsList: LogEntry[] = [];
  let needsRepopulate = false;

  if (stored) {
    try {
      logsList = JSON.parse(stored);
      // Migrate if it's the old 3-item flat list without historical streaks
      if (logsList.length === 3 && logsList.every(l => ["Alice Vance", "Bob Smith", "Charlie Brown"].includes(l.name))) {
        needsRepopulate = true;
      }
    } catch (e) {
      needsRepopulate = true;
    }
  } else {
    needsRepopulate = true;
  }

  if (needsRepopulate) {
    const initialLogs: LogEntry[] = [];
    const nowMs = Date.now();
    
    // Alice Vance - 5 day streak (logged in today, yesterday, and 3 previous days)
    for (let i = 0; i < 5; i++) {
      initialLogs.push({
        id: crypto.randomUUID(),
        name: "Alice Vance",
        type: "login",
        role: "admin",
        image_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        created_at: new Date(nowMs - 86400000 * i - 3600000 * 2).toISOString(),
      });
    }

    // Bob Smith - 3 day streak (logged in today, yesterday, and the day before)
    for (let i = 0; i < 3; i++) {
      initialLogs.push({
        id: crypto.randomUUID(),
        name: "Bob Smith",
        type: "login",
        role: "staff",
        image_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        created_at: new Date(nowMs - 86400000 * i - 3600000 * 4).toISOString(),
      });
    }

    // Charlie Brown - 2 day streak (logged in today and yesterday)
    for (let i = 0; i < 2; i++) {
      initialLogs.push({
        id: crypto.randomUUID(),
        name: "Charlie Brown",
        type: "login",
        role: "intern",
        image_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
        created_at: new Date(nowMs - 86400000 * i - 3600000 * 6).toISOString(),
      });
    }

    localStorage.setItem("office_logs", JSON.stringify(initialLogs));
    return initialLogs;
  }
  return logsList;
}

function saveMockLogs(logs: LogEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("office_logs", JSON.stringify(logs));
}

function getMockActivityLogs(): AdminActivityLog[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("admin_activity_logs");
  return stored ? JSON.parse(stored) : [];
}

function saveMockActivityLogs(logs: AdminActivityLog[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("admin_activity_logs", JSON.stringify(logs));
}

/**
 * Upload the captured photo to Supabase Storage and record a log entry.
 * Returns the inserted row.
 */
export async function createLog(
  name: string,
  type: LogType,
  imageDataUrl: string,
  role: UserRole = "intern"
): Promise<LogEntry> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Please enter your name.");
  if (!imageDataUrl) throw new Error("Please capture a photo first.");

  if (IS_MOCK) {
    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      name: trimmedName,
      type,
      role,
      image_url: imageDataUrl, // Store base64 data url directly in offline mode
      created_at: new Date().toISOString(),
    };
    const logs = getMockLogs();
    logs.unshift(newLog);
    saveMockLogs(logs);
    return newLog;
  }

  const blob = dataUrlToBlob(imageDataUrl);
  const safeName = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const path = `${safeName}/${type}-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error } = await supabase
    .from("logs")
    .insert({ name: trimmedName, type, role, image_url: publicUrl });

  if (error) {
    throw new Error(`Saving log failed: ${error.message}`);
  }

  return {
    id: crypto.randomUUID(),
    name: trimmedName,
    type,
    role,
    image_url: publicUrl,
    created_at: new Date().toISOString(),
  } as LogEntry;
}

/**
 * Saves multiple log entries (e.g. group log ins) with the same captured photo.
 */
export async function createMultipleLogs(
  people: Array<{ name: string; role: UserRole }>,
  type: LogType,
  imageDataUrl: string
): Promise<LogEntry[]> {
  if (people.length === 0) throw new Error("Please add at least one person.");
  if (!imageDataUrl) throw new Error("Please capture a photo first.");

  if (IS_MOCK) {
    const logs = getMockLogs();
    const createdLogs: LogEntry[] = [];
    const timestamp = new Date().toISOString();

    for (const person of people) {
      const trimmedName = person.name.trim();
      if (!trimmedName) continue;
      const newLog: LogEntry = {
        id: crypto.randomUUID(),
        name: trimmedName,
        type,
        role: person.role,
        image_url: imageDataUrl,
        created_at: timestamp,
      };
      logs.unshift(newLog);
      createdLogs.push(newLog);
    }
    saveMockLogs(logs);
    return createdLogs;
  }

  // Live Supabase path
  const blob = dataUrlToBlob(imageDataUrl);
  const safeName = people[0].name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const path = `group-${safeName}/${type}-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const rows = people
    .filter(p => p.name.trim().length > 0)
    .map(p => ({
      name: p.name.trim(),
      type,
      role: p.role,
      image_url: publicUrl
    }));

  const { error } = await supabase
    .from("logs")
    .insert(rows);

  if (error) {
    throw new Error(`Saving group logs failed: ${error.message}`);
  }

  return rows.map(r => ({
    id: crypto.randomUUID(),
    ...r,
    created_at: new Date().toISOString(),
  })) as LogEntry[];
}

/** Fetch the most recent log entries, newest first. */
export async function getLogs(limit = 200): Promise<LogEntry[]> {
  if (IS_MOCK) {
    return getMockLogs().slice(0, limit);
  }

  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as LogEntry[];
}

/** Get list of auto-search suggestions (unique names + their last roles) */
export async function getNameSuggestions(): Promise<Array<{ name: string; role: UserRole }>> {
  const logs = await getLogs(1000);
  const map = new Map<string, UserRole>();
  
  // Iterate back in time to catch the most recent role for each name
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    map.set(log.name.trim(), log.role);
  }

  return Array.from(map.entries()).map(([name, role]) => ({ name, role }));
}

/** Calculate user's current consecutive login streak in days */
export function calculateStreak(logs: LogEntry[], name: string): number {
  const userLogins = logs
    .filter(
      (l) =>
        l.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        l.type === "login"
    )
    .map((l) => new Date(l.created_at).toDateString());

  // Unique dates sorted descending
  const uniqueDates = Array.from(new Set(userLogins))
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  if (uniqueDates.length === 0) return 0;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const dateStr = (d: Date) => d.toDateString();
  const latestDate = uniqueDates[0];

  // If latest login is not today and not yesterday, streak is broken
  if (
    dateStr(latestDate) !== dateStr(today) &&
    dateStr(latestDate) !== dateStr(yesterday)
  ) {
    return 0;
  }

  let streak = 1;
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const current = uniqueDates[i];
    const next = uniqueDates[i + 1];

    const diffTime = current.getTime() - next.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
    } else if (diffDays > 1) {
      break;
    }
  }

  return streak;
}

/** Log administrative audit logs */
export async function createActivityLog(action: string, details: string): Promise<void> {
  if (IS_MOCK) {
    const logs = getMockActivityLogs();
    const newLog: AdminActivityLog = {
      id: crypto.randomUUID(),
      action,
      details,
      created_at: new Date().toISOString(),
    };
    logs.unshift(newLog);
    saveMockActivityLogs(logs);
    return;
  }

  await supabase
    .from("admin_activity_logs")
    .insert({ action, details });
}

/** Fetch administrative activity audit logs */
export async function getActivityLogs(limit = 100): Promise<AdminActivityLog[]> {
  if (IS_MOCK) {
    return getMockActivityLogs().slice(0, limit);
  }

  const { data, error } = await supabase
    .from("admin_activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminActivityLog[];
}
