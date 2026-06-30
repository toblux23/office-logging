import { describe, it, expect, beforeEach } from "vitest";
import {
  createLog,
  createMultipleLogs,
  getNameSuggestions,
  registerStaffOrIntern,
  renameUser,
  deleteUser,
  updateUserRole,
  getStaffInternUsers,
  getLogs,
  calculateStreak,
  createActivityLog,
  getAdminConfig,
  getAdminList,
  deleteAdmin,
  getActivityLogs,
} from "../lib/logs";
import type { LogEntry } from "../lib/supabase";

const DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

beforeEach(() => {
  localStorage.clear();
});

describe("calculateStreak", () => {
  it("returns 0 for empty logs", () => {
    expect(calculateStreak([], "Any Name")).toBe(0);
  });

  it("returns 0 when user has no login entries", () => {
    const logs: LogEntry[] = [
      { id: "1", name: "Other User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date().toISOString() },
    ];
    expect(calculateStreak(logs, "Target User")).toBe(0);
  });

  it("returns 0 when latest login is older than yesterday", () => {
    const logs: LogEntry[] = [
      { id: "1", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
    ];
    expect(calculateStreak(logs, "User")).toBe(0);
  });

  it("returns 1 for a single login today", () => {
    const logs: LogEntry[] = [
      { id: "1", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date().toISOString() },
    ];
    expect(calculateStreak(logs, "User")).toBe(1);
  });

  it("returns 2 for consecutive today and yesterday", () => {
    const now = Date.now();
    const logs: LogEntry[] = [
      { id: "1", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(now).toISOString() },
      { id: "2", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(now - 86400000).toISOString() },
    ];
    expect(calculateStreak(logs, "User")).toBe(2);
  });

  it("returns 3 for three consecutive days", () => {
    const now = Date.now();
    const logs: LogEntry[] = [
      { id: "1", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(now).toISOString() },
      { id: "2", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(now - 86400000).toISOString() },
      { id: "3", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(now - 86400000 * 2).toISOString() },
    ];
    expect(calculateStreak(logs, "User")).toBe(3);
  });

  it("does not count duplicate dates multiple times", () => {
    const now = Date.now();
    const logs: LogEntry[] = [
      { id: "1", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(now).toISOString() },
      { id: "2", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(now).toISOString() },
      { id: "3", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(now - 86400000).toISOString() },
    ];
    expect(calculateStreak(logs, "User")).toBe(2);
  });

  it("breaks streak when there is a gap", () => {
    const now = Date.now();
    const logs: LogEntry[] = [
      { id: "1", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(now).toISOString() },
      { id: "2", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(now - 86400000).toISOString() },
      { id: "3", name: "User", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date(now - 86400000 * 4).toISOString() },
    ];
    expect(calculateStreak(logs, "User")).toBe(2);
  });

  it("is case-insensitive with name matching", () => {
    const logs: LogEntry[] = [
      { id: "1", name: "Alice", type: "login", role: "guest", state: "in_office", image_url: "", created_at: new Date().toISOString() },
    ];
    expect(calculateStreak(logs, "alice")).toBe(1);
  });
});

describe("createActivityLog and getActivityLogs", () => {
  it("creates and retrieves activity logs", async () => {
    await createActivityLog("TEST_ACTION", "Test details");
    const logs = await getActivityLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("TEST_ACTION");
    expect(logs[0].details).toBe("Test details");
  });

  it("returns multiple logs in reverse chronological order", async () => {
    await createActivityLog("FIRST", "First action");
    await createActivityLog("SECOND", "Second action");
    const logs = await getActivityLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe("SECOND");
    expect(logs[1].action).toBe("FIRST");
  });

  it("respects limit parameter", async () => {
    await createActivityLog("A", "A");
    await createActivityLog("B", "B");
    await createActivityLog("C", "C");
    const logs = await getActivityLogs(2);
    expect(logs).toHaveLength(2);
  });
});

describe("getAdminConfig", () => {
  it("returns a default admin config when none stored", async () => {
    localStorage.removeItem("mock_admin_config_list");
    const config = await getAdminConfig();
    expect(config).not.toBeNull();
    expect(config!.email).toBe("admin@startuplab.com");
  });

  it("returns null for non-existent email", async () => {
    const config = await getAdminConfig("nonexistent@test.com");
    expect(config).toBeNull();
  });

  it("finds admin by email", async () => {
    const config = await getAdminConfig("admin@startuplab.com");
    expect(config).not.toBeNull();
    expect(config!.email).toBe("admin@startuplab.com");
  });
});

describe("getAdminList and deleteAdmin", () => {
  it("returns empty list when no admins stored", async () => {
    localStorage.removeItem("mock_admin_config_list");
    const list = await getAdminList();
    expect(list).toEqual([]);
  });

  it("returns default admin when list is primed via getAdminConfig", async () => {
    localStorage.removeItem("mock_admin_config_list");
    await getAdminConfig();
    const list = await getAdminList();
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it("deleteAdmin removes an admin", async () => {
    localStorage.setItem("mock_admin_config_list", JSON.stringify([
      { email: "admin1@test.com", created_at: "2024-01-01" },
      { email: "admin2@test.com", created_at: "2024-01-02" },
    ]));
    await deleteAdmin("admin1@test.com");
    const list = await getAdminList();
    expect(list).toHaveLength(1);
    expect(list[0].email).toBe("admin2@test.com");
  });
});

describe("getNameSuggestions edge cases", () => {
  it("returns empty array when no users or logs exist", async () => {
    localStorage.setItem("office_logs", "[]");
    localStorage.setItem("office_users", "[]");
    const suggestions = await getNameSuggestions();
    expect(suggestions).toEqual([]);
  });

  it("includes registered users in suggestions", async () => {
    await registerStaffOrIntern("Test User", "staff");
    const suggestions = await getNameSuggestions();
    expect(suggestions).toEqual(
      expect.arrayContaining([{ name: "Test User", role: "staff" }])
    );
  });

  it("includes walk-in users after their first log", async () => {
    await createLog("WalkIn Guest", "login", DATA_URL, "guest");
    const suggestions = await getNameSuggestions();
    expect(suggestions).toEqual(
      expect.arrayContaining([{ name: "WalkIn Guest", role: "guest" }])
    );
  });

  it("returns unique suggestions sorted by name", async () => {
    localStorage.setItem("office_logs", "[]");
    localStorage.setItem("office_users", "[]");
    await registerStaffOrIntern("Z User", "intern");
    await registerStaffOrIntern("A User", "staff");
    const suggestions = await getNameSuggestions();
    const names = suggestions.map((s) => s.name);
    expect(names).toEqual([...names].sort());
  });
});

describe("createLog edge cases", () => {
  it("trims whitespace from names", async () => {
    const log = await createLog("  Trimmed Name  ", "login", DATA_URL, "guest");
    expect(log.name).toBe("Trimmed Name");
  });

  it("rejects name with only whitespace", async () => {
    await expect(
      createLog("   ", "login", DATA_URL, "guest")
    ).rejects.toThrow("Please enter your name");
  });

  it("is case-insensitive for existing user state checks", async () => {
    await createLog("CaseTest", "login", DATA_URL, "guest");
    await expect(
      createLog("casetest", "login", DATA_URL, "guest")
    ).rejects.toThrow("can't log in (currently in office)");
  });
});

describe("createMultipleLogs edge cases", () => {
  it("skips empty names in the people list", async () => {
    const logs = await createMultipleLogs(
      [
        { name: "Valid Person", role: "guest" },
        { name: "", role: "guest" },
      ],
      "login",
      DATA_URL
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].name).toBe("Valid Person");
  });

  it("handles a mix of valid and invalid people", async () => {
    await expect(
      createMultipleLogs(
        [
          { name: "Valid Guest", role: "guest" },
          { name: "Invalid Staff", role: "staff" },
        ],
        "login",
        DATA_URL
      )
    ).rejects.toThrow("not registered");
  });

  it("rejects empty people list", async () => {
    await expect(
      createMultipleLogs([], "login", DATA_URL)
    ).rejects.toThrow("add at least one person");
  });

  it("rejects missing photo", async () => {
    await expect(
      createMultipleLogs([{ name: "Person", role: "guest" }], "login", "")
    ).rejects.toThrow("Please capture a photo first");
  });
});

describe("getStaffInternUsers edge cases", () => {
  it("returns empty array when no users registered", async () => {
    localStorage.setItem("office_logs", "[]");
    localStorage.setItem("office_users", "[]");
    const users = await getStaffInternUsers();
    expect(users).toEqual([]);
  });

  it("does not include guest or client users", async () => {
    await createLog("Guest User", "login", DATA_URL, "guest");
    await createLog("Client User", "login", DATA_URL, "client");
    const users = await getStaffInternUsers();
    expect(users.find((u) => u.name === "Guest User")).toBeFalsy();
    expect(users.find((u) => u.name === "Client User")).toBeFalsy();
  });

  it("includes only staff and intern users", async () => {
    localStorage.setItem("office_logs", "[]");
    localStorage.setItem("office_users", "[]");
    await registerStaffOrIntern("Staff One", "staff");
    await registerStaffOrIntern("Intern One", "intern");
    const users = await getStaffInternUsers();
    expect(users).toHaveLength(2);
  });

  it("returns users sorted by name", async () => {
    localStorage.setItem("office_logs", "[]");
    localStorage.setItem("office_users", "[]");
    await registerStaffOrIntern("B User", "staff");
    await registerStaffOrIntern("A User", "intern");
    const users = await getStaffInternUsers();
    expect(users[0].name).toBe("A User");
    expect(users[1].name).toBe("B User");
  });
});

describe("deleteUser edge cases", () => {
  it("rejects empty name", async () => {
    await expect(deleteUser("")).rejects.toThrow("Please provide a name");
  });

  it("only deletes exact name match (case-insensitive)", async () => {
    await registerStaffOrIntern("Target User", "staff");
    await expect(deleteUser("target user")).resolves.not.toThrow();
    const users = await getStaffInternUsers();
    expect(users.find((u) => u.name === "Target User")).toBeFalsy();
  });
});

describe("renameUser edge cases", () => {
  it("rejects empty old name", async () => {
    await expect(renameUser("", "New Name")).rejects.toThrow("Please provide the current name");
  });

  it("rejects empty new name", async () => {
    await expect(renameUser("Old Name", "")).rejects.toThrow("Please provide a new name");
  });
});

describe("updateUserRole edge cases", () => {
  it("rejects empty name", async () => {
    await expect(updateUserRole("", "staff")).rejects.toThrow("Please provide a name");
  });

  it("rejects non-registrable roles", async () => {
    await expect(updateUserRole("User", "guest" as any)).rejects.toThrow("Only staff and intern roles");
  });

  it("rejects update for non-existent user", async () => {
    await expect(updateUserRole("NonExistent", "staff")).rejects.toThrow("not found");
  });
});

describe("getLogs", () => {
  it("returns empty array when no logs exist", async () => {
    localStorage.setItem("office_logs", "[]");
    const logs = await getLogs();
    expect(logs).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    await createLog("User1", "login", DATA_URL, "guest");
    await createLog("User2", "login", DATA_URL, "guest");
    await createLog("User3", "login", DATA_URL, "guest");
    const limited = await getLogs(2);
    expect(limited).toHaveLength(2);
  });

  it("returns logs in reverse chronological order", async () => {
    await createLog("First", "login", DATA_URL, "guest");
    await createLog("Second", "login", DATA_URL, "guest");
    const logs = await getLogs();
    expect(logs[0].name).toBe("Second");
    expect(logs[1].name).toBe("First");
  });
});
