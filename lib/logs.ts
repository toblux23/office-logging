import { supabase, type LogEntry, type LogType, type UserRole, type UserState, type AdminConfig, type AdminActivityLog, type User, IS_MOCK } from "./supabase";

const BUCKET = "log-images";
export type RegistrableRole = Extract<UserRole, "staff" | "intern">;

// --- State machine -------------------------------------------------
const ALLOWED_TRANSITIONS: Record<string, LogType[]> = {
  unknown: ["login"],
  out_of_office: ["login"],
  in_office: ["logout", "break"],
  on_break: ["login", "logout"],
};

const NEXT_STATE: Record<LogType, UserState> = {
  login: "in_office",
  logout: "out_of_office",
  break: "on_break",
};

const ACTION_LABELS: Record<LogType, string> = {
  login: "log in",
  logout: "log out",
  break: "go on break",
};

const STATE_LABELS: Record<string, string> = {
  unknown: "out of office",
  out_of_office: "out of office",
  in_office: "in office",
  on_break: "on break",
};

const WALK_IN_ROLES = new Set<UserRole>(["guest", "client"]);
const USER_ROLES: UserRole[] = ["staff", "intern", "guest", "client"];
const REGISTRABLE_ROLES: RegistrableRole[] = ["staff", "intern"];

interface UserProfile {
  name: string;
  role: UserRole;
  state: UserState;
}

interface ValidatedPerson {
  name: string;
  role: UserRole;
  state: UserState;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function roleLabel(role: UserRole): string {
  return role;
}

function normalizeUserRole(role: string): UserRole | null {
  const normalizedRole = role.trim().toLowerCase();
  return USER_ROLES.find((userRole) => userRole === normalizedRole) ?? null;
}

function normalizeRegistrableRole(role: string): RegistrableRole | null {
  const normalizedRole = role.trim().toLowerCase();
  return REGISTRABLE_ROLES.find((userRole) => userRole === normalizedRole) ?? null;
}

function addNameSuggestion(
  suggestionsByName: Map<string, { name: string; role: UserRole }>,
  name: string,
  role: string
) {
  const normalizedRole = normalizeUserRole(role);
  if (!name.trim() || !normalizedRole) return;

  const normalizedName = normalizeName(name);
  if (!suggestionsByName.has(normalizedName)) {
    suggestionsByName.set(normalizedName, { name: name.trim(), role: normalizedRole });
  }
}

function assertAllowedAction(currentState: string, type: LogType, name: string, role?: UserRole): void {
  const allowed = ALLOWED_TRANSITIONS[currentState];
  if (!allowed?.includes(type)) {
    if (currentState === "unknown") {
      throw new Error(`${name} not found as ${role ? roleLabel(role) : "that role"}. Contact an administrator.`);
    }
    throw new Error(
      `${name} can't ${ACTION_LABELS[type]} (currently ${STATE_LABELS[currentState] ?? currentState}).`
    );
  }
  if (currentState === "unknown" && type === "login" && role && !WALK_IN_ROLES.has(role)) {
    throw new Error(`${name} is not registered as ${roleLabel(role)}. Contact an administrator.`);
  }
}

function assertRoleMatches(profile: UserProfile, selectedRole: UserRole, inputName: string): void {
  if (profile.role === selectedRole) return;

  throw new Error(
    `${inputName.trim()} is not registered as ${roleLabel(selectedRole)}. Please select ${roleLabel(profile.role)} or contact an administrator.`
  );
}

async function getUserProfile(name: string): Promise<UserProfile | null> {
  if (IS_MOCK) {
    const profile = getMockUser(name);
    if (!profile) return null;

    return {
      ...profile,
      role: normalizeUserRole(profile.role) ?? profile.role,
    };
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("name, role, state")
    .eq("name", name)
    .maybeSingle();

  if (userError) throw new Error(userError.message);

  if (user) {
    return {
      name: user.name,
      role: normalizeUserRole(user.role) ?? (user.role as UserRole),
      state: user.state as UserState,
    };
  }

  const { data: log } = await supabase
    .from("logs")
    .select("name, role, state")
    .eq("name", name)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!log) return null;

  return {
    name: log.name,
    role: normalizeUserRole(log.role) ?? (log.role as UserRole),
    state: log.state as UserState,
  };
}

async function validatePerson(name: string, type: LogType, role: UserRole): Promise<ValidatedPerson> {
  const trimmedName = name.trim();
  const profile = await getUserProfile(trimmedName);

  if (!profile) {
    assertAllowedAction("unknown", type, trimmedName, role);
    return {
      name: trimmedName,
      role,
      state: NEXT_STATE[type],
    };
  }

  assertRoleMatches(profile, role, trimmedName);
  assertAllowedAction(profile.state, type, profile.name, role);

  return {
    name: profile.name,
    role: profile.role,
    state: NEXT_STATE[type],
  };
}

// --- Mock helpers --------------------------------------------------
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
      } else {
        // Migrate old state values (present→in_office, absent→out_of_office)
        logsList = logsList.map(l => {
          const oldState = l.state as string;
          if (oldState === "present") return { ...l, state: "in_office" as UserState };
          if (oldState === "absent") return { ...l, state: "out_of_office" as UserState };
          return l;
        });
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
        role: "staff",
        state: "in_office",
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
        state: "in_office",
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
        state: "in_office",
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

function getMockUsers(): User[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("office_users");

  if (stored) {
    return JSON.parse(stored) as User[];
  }

  // First load: derive from logs and persist
  const usersByName = new Map<string, User>();
  for (const log of getMockLogs()) {
    const key = normalizeName(log.name);
    if (!usersByName.has(key)) {
      usersByName.set(key, {
        name: log.name,
        role: log.role,
        state: log.state,
        updated_at: log.created_at,
      });
    }
  }
  const users = Array.from(usersByName.values());
  saveMockUsers(users);
  return users;
}

function saveMockUsers(users: User[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("office_users", JSON.stringify(users));
}

function getMockUser(name: string): User | null {
  const normalizedName = normalizeName(name);
  return getMockUsers().find(u => normalizeName(u.name) === normalizedName) ?? null;
}

function upsertMockUser(name: string, role: UserRole, state: UserState) {
  const users = getMockUsers();
  const idx = users.findIndex(u => normalizeName(u.name) === normalizeName(name));
  const user: User = { name, role, state, updated_at: new Date().toISOString() };
  if (idx >= 0) {
    users[idx] = user;
  } else {
    users.push(user);
  }
  saveMockUsers(users);
}

export async function getStaffInternUsers(): Promise<User[]> {
  if (IS_MOCK) {
    return getMockUsers()
      .filter((user) => REGISTRABLE_ROLES.includes(user.role as RegistrableRole))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .in("role", ["staff", "intern"])
    .order("name");

  if (error) throw new Error(error.message);

  return ((data ?? []) as User[])
    .map((user) => ({
      ...user,
      role: normalizeRegistrableRole(user.role) ?? user.role,
      state: user.state ?? "out_of_office",
    }))
    .filter((user): user is User => REGISTRABLE_ROLES.includes(user.role as RegistrableRole))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function registerStaffOrIntern(name: string, role: RegistrableRole): Promise<User> {
  const trimmedName = name.trim();
  const normalizedRole = normalizeRegistrableRole(role);

  if (!trimmedName) throw new Error("Please enter a name.");
  if (!normalizedRole) throw new Error("Only staff and interns can be registered here.");

  if (IS_MOCK) {
    const users = getMockUsers();
    const exists = users.some((u) => normalizeName(u.name) === normalizeName(trimmedName));
    if (exists) {
      throw new Error(`User "${trimmedName}" already exists. Edit them instead.`);
    }

    const user: User = {
      name: trimmedName,
      role: normalizedRole,
      state: "out_of_office",
      updated_at: new Date().toISOString(),
    };
    users.push(user);
    saveMockUsers(users);
    return user;
  }

  const { data: existing } = await supabase
    .from("users")
    .select("name")
    .ilike("name", trimmedName)
    .maybeSingle();

  if (existing) {
    throw new Error(`User "${trimmedName}" already exists. Edit them instead.`);
  }

  const { data, error } = await supabase
    .from("users")
    .insert({ name: trimmedName, role: normalizedRole, state: "out_of_office", updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    name: data.name,
    role: normalizeRegistrableRole(data.role) ?? normalizedRole,
    state: data.state as UserState,
    updated_at: data.updated_at,
  };
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
    const logs = getMockLogs();
    const validated = await validatePerson(trimmedName, type, role);
    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      name: validated.name,
      type,
      role: validated.role,
      state: validated.state,
      image_url: imageDataUrl,
      created_at: new Date().toISOString(),
    };
    logs.unshift(newLog);
    saveMockLogs(logs);
    upsertMockUser(validated.name, validated.role, validated.state);
    return newLog;
  }

  const validated = await validatePerson(trimmedName, type, role);

  const blob = dataUrlToBlob(imageDataUrl);
  const safeName = validated.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
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
    .insert({ name: validated.name, type, role: validated.role, state: validated.state, image_url: publicUrl });

  if (error) {
    throw new Error(`Saving log failed: ${error.message}`);
  }

  const { error: upsertError } = await supabase
    .from("users")
    .upsert({ name: validated.name, role: validated.role, state: validated.state, updated_at: new Date().toISOString() });

  if (upsertError) {
    console.error("Failed to update user state:", upsertError.message);
  }

  return {
    id: crypto.randomUUID(),
    name: validated.name,
    type,
    role: validated.role,
    state: validated.state,
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
      const validated = await validatePerson(trimmedName, type, person.role);
      const newLog: LogEntry = {
        id: crypto.randomUUID(),
        name: validated.name,
        type,
        role: validated.role,
        state: validated.state,
        image_url: imageDataUrl,
        created_at: timestamp,
      };
      logs.unshift(newLog);
      createdLogs.push(newLog);
      upsertMockUser(validated.name, validated.role, validated.state);
    }
    saveMockLogs(logs);
    return createdLogs;
  }

  // Live Supabase path
  const validPeople = people.filter(p => p.name.trim().length > 0);

  // Validate all state transitions before doing expensive operations
  const stateResults = await Promise.all(
    validPeople.map(p => validatePerson(p.name.trim(), type, p.role))
  );

  const blob = dataUrlToBlob(imageDataUrl);
  const safeName = stateResults[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
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

  const rows = stateResults.map(p => ({
    name: p.name,
    type,
    role: p.role,
    state: p.state,
    image_url: publicUrl,
  }));

  const { error } = await supabase
    .from("logs")
    .insert(rows);

  if (error) {
    throw new Error(`Saving group logs failed: ${error.message}`);
  }

  // Upsert user states for each person
  await Promise.all(
    stateResults.map(p =>
      (async () => {
        const { error } = await supabase
          .from("users")
          .upsert({ name: p.name, role: p.role, state: p.state, updated_at: new Date().toISOString() });
        if (error) console.error(`Failed to update state for ${p.name}:`, error.message);
      })()
    )
  );

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

/** Get list of auto-search suggestions from the user directory. */
export async function getNameSuggestions(): Promise<Array<{ name: string; role: UserRole }>> {
  const suggestionsByName = new Map<string, { name: string; role: UserRole }>();

  if (IS_MOCK) {
    for (const { name, role } of getMockUsers()) {
      addNameSuggestion(suggestionsByName, name, role);
    }
    return Array.from(suggestionsByName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("name, role");

  if (error) {
    console.warn("Could not load user directory suggestions:", error.message);
  } else {
    for (const { name, role } of users ?? []) {
      addNameSuggestion(suggestionsByName, name, role);
    }
  }

  try {
    for (const { name, role } of await getLogs(1000)) {
      addNameSuggestion(suggestionsByName, name, role);
    }
  } catch (error) {
    console.warn("Could not merge log names into suggestions:", error);
  }

  return Array.from(suggestionsByName.values()).sort((a, b) => a.name.localeCompare(b.name));
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

// --- Admin CRUD for users ------------------------------------------

export async function deleteUser(name: string): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Please provide a name.");

  if (IS_MOCK) {
    const users = getMockUsers();
    const filtered = users.filter((u) => normalizeName(u.name) !== normalizeName(trimmedName));
    if (filtered.length === users.length) {
      throw new Error(`User "${trimmedName}" not found.`);
    }
    saveMockUsers(filtered);
    return;
  }

  const { data: toDelete, error: fetchError } = await supabase
    .from("users")
    .select("name")
    .ilike("name", trimmedName)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!toDelete) throw new Error(`User "${trimmedName}" not found.`);

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("name", toDelete.name);

  if (error) throw new Error(error.message);
}

export async function renameUser(oldName: string, newName: string): Promise<User> {
  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();

  if (!trimmedOld) throw new Error("Please provide the current name.");
  if (!trimmedNew) throw new Error("Please provide a new name.");
  if (normalizeName(trimmedOld) === normalizeName(trimmedNew)) {
    throw new Error("New name is the same as the current name.");
  }

  if (IS_MOCK) {
    const users = getMockUsers();
    const idx = users.findIndex((u) => normalizeName(u.name) === normalizeName(trimmedOld));
    if (idx < 0) throw new Error(`User "${trimmedOld}" not found.`);

    const newNameTaken = users.some(
      (u, i) => i !== idx && normalizeName(u.name) === normalizeName(trimmedNew)
    );
    if (newNameTaken) {
      throw new Error(`User "${trimmedNew}" already exists.`);
    }

    users[idx] = { ...users[idx], name: trimmedNew, updated_at: new Date().toISOString() };
    saveMockUsers(users);
    return users[idx];
  }

  const { data: nameTaken } = await supabase
    .from("users")
    .select("name")
    .ilike("name", trimmedNew)
    .maybeSingle();

  if (nameTaken) throw new Error(`User "${trimmedNew}" already exists.`);

  const { data: found } = await supabase
    .from("users")
    .select("name")
    .ilike("name", trimmedOld)
    .maybeSingle();

  if (!found) throw new Error(`User "${trimmedOld}" not found.`);

  const { data, error } = await supabase
    .from("users")
    .update({ name: trimmedNew, updated_at: new Date().toISOString() })
    .eq("name", found.name)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    name: data.name,
    role: data.role as UserRole,
    state: data.state as UserState,
    updated_at: data.updated_at,
  };
}

export async function updateUserRole(name: string, newRole: RegistrableRole): Promise<User> {
  const trimmedName = name.trim();
  const normalizedRole = normalizeRegistrableRole(newRole);

  if (!trimmedName) throw new Error("Please provide a name.");
  if (!normalizedRole) throw new Error("Only staff and intern roles are valid.");

  if (IS_MOCK) {
    const users = getMockUsers();
    const idx = users.findIndex((u) => normalizeName(u.name) === normalizeName(trimmedName));
    if (idx < 0) throw new Error(`User "${trimmedName}" not found.`);

    users[idx] = { ...users[idx], role: normalizedRole, updated_at: new Date().toISOString() };
    saveMockUsers(users);
    return users[idx];
  }

  const { data: found } = await supabase
    .from("users")
    .select("name")
    .ilike("name", trimmedName)
    .maybeSingle();

  if (!found) throw new Error(`User "${trimmedName}" not found.`);

  const { data, error } = await supabase
    .from("users")
    .update({ role: normalizedRole, updated_at: new Date().toISOString() })
    .eq("name", found.name)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    name: data.name,
    role: normalizeRegistrableRole(data.role) ?? normalizedRole,
    state: data.state as UserState,
    updated_at: data.updated_at,
  };
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

/** Fetch admin config rows. If email is provided, returns that row or null. */
export async function getAdminConfig(email?: string): Promise<AdminConfig | null> {
  if (IS_MOCK) {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("mock_admin_config_list");
    const list: AdminConfig[] = stored
      ? JSON.parse(stored)
      : [{ email: "admin@startuplab.com", created_at: new Date().toISOString() }];
    if (!stored) {
      localStorage.setItem("mock_admin_config_list", JSON.stringify(list));
    }
    if (email) return list.find((a) => a.email === email) ?? null;
    return list[0] ?? null;
  }

  let query = supabase.from("admin_config").select("*");
  if (email) {
    query = query.eq("email", email);
  }
  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  return data as AdminConfig | null;
}

/** Fetch all admin emails (for the Admin Management panel) */
export async function getAdminList(): Promise<AdminConfig[]> {
  if (IS_MOCK) {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("mock_admin_config_list");
    return stored ? JSON.parse(stored) : [];
  }

  const { data, error } = await supabase
    .from("admin_config")
    .select("*")
    .order("created_at");

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminConfig[];
}

/** Delete an admin by email (cannot delete yourself). */
export async function deleteAdmin(email: string): Promise<void> {
  if (IS_MOCK) {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("mock_admin_config_list");
    if (!stored) return;
    const list: AdminConfig[] = JSON.parse(stored);
    const filtered = list.filter((a) => a.email !== email);
    localStorage.setItem("mock_admin_config_list", JSON.stringify(filtered));
    return;
  }

  const { error } = await supabase
    .from("admin_config")
    .delete()
    .eq("email", email);

  if (error) throw new Error(error.message);
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
