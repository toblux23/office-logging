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
} from "../lib/logs";

const DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

beforeEach(() => {
  localStorage.clear();
});

describe("state transitions", () => {
  describe("unknown user", () => {
    it("cannot login as staff", async () => {
      await expect(
        createLog("NewStaff", "login", DATA_URL, "staff")
      ).rejects.toThrow("not registered");
    });

    it("cannot login as intern", async () => {
      await expect(
        createLog("NewIntern", "login", DATA_URL, "intern")
      ).rejects.toThrow("not registered");
    });

    it("can login as client", async () => {
      const log = await createLog("NewClient", "login", DATA_URL, "client");
      expect(log.type).toBe("login");
      expect(log.state).toBe("in_office");
    });

    it("can login as guest", async () => {
      const log = await createLog("NewGuest", "login", DATA_URL, "guest");
      expect(log.type).toBe("login");
      expect(log.state).toBe("in_office");
    });

    it("cannot logout", async () => {
      await expect(
        createLog("UnknownUser", "logout", DATA_URL, "guest")
      ).rejects.toThrow("not found");
    });

    it("cannot go on break", async () => {
      await expect(
        createLog("UnknownUser", "break", DATA_URL, "guest")
      ).rejects.toThrow("not found");
    });
  });

  describe("guest and client lifecycle", () => {
    it("guest can login and become in_office", async () => {
      const log = await createLog("GuestLifecycle", "login", DATA_URL, "guest");
      expect(log.state).toBe("in_office");
    });

    it("client can login and become in_office", async () => {
      const log = await createLog("ClientLifecycle", "login", DATA_URL, "client");
      expect(log.state).toBe("in_office");
    });

    it("in_office user cannot login again", async () => {
      await createLog("DoubleLogin", "login", DATA_URL, "guest");
      await expect(
        createLog("DoubleLogin", "login", DATA_URL, "guest")
      ).rejects.toThrow("can't log in (currently in office)");
    });

    it("in_office user can go on break", async () => {
      await createLog("BreakTest", "login", DATA_URL, "guest");
      const log = await createLog("BreakTest", "break", DATA_URL, "guest");
      expect(log.state).toBe("on_break");
    });

    it("in_office user can log out", async () => {
      await createLog("LogoutTest", "login", DATA_URL, "guest");
      const log = await createLog("LogoutTest", "logout", DATA_URL, "guest");
      expect(log.state).toBe("out_of_office");
    });

    it("out_of_office user can login again", async () => {
      await createLog("ReLogin", "login", DATA_URL, "guest");
      await createLog("ReLogin", "logout", DATA_URL, "guest");
      const log = await createLog("ReLogin", "login", DATA_URL, "guest");
      expect(log.state).toBe("in_office");
    });

    it("on_break user can login again", async () => {
      await createLog("BreakLogin", "login", DATA_URL, "guest");
      await createLog("BreakLogin", "break", DATA_URL, "guest");
      const log = await createLog("BreakLogin", "login", DATA_URL, "guest");
      expect(log.state).toBe("in_office");
    });

    it("on_break user can log out", async () => {
      await createLog("BreakLogout", "login", DATA_URL, "guest");
      await createLog("BreakLogout", "break", DATA_URL, "guest");
      const log = await createLog("BreakLogout", "logout", DATA_URL, "guest");
      expect(log.state).toBe("out_of_office");
    });

    it("on_break user cannot go on break again", async () => {
      await createLog("DoubleBreak", "login", DATA_URL, "guest");
      await createLog("DoubleBreak", "break", DATA_URL, "guest");
      await expect(
        createLog("DoubleBreak", "break", DATA_URL, "guest")
      ).rejects.toThrow("can't go on break (currently on break)");
    });
  });

  describe("createMultipleLogs", () => {
    it("rejects unknown non-guest non-client in group", async () => {
      await expect(
        createMultipleLogs(
          [{ name: "GroupStaff", role: "staff" }],
          "login",
          DATA_URL
        )
      ).rejects.toThrow("not registered");
    });

    it("allows multiple guests to login together", async () => {
      const logs = await createMultipleLogs(
        [
          { name: "GuestOne", role: "guest" },
          { name: "GuestTwo", role: "guest" },
        ],
        "login",
        DATA_URL
      );
      expect(logs).toHaveLength(2);
      logs.forEach(l => {
        expect(l.type).toBe("login");
        expect(l.state).toBe("in_office");
      });
    });

    it("allows clients to login together", async () => {
      const logs = await createMultipleLogs(
        [
          { name: "ClientOne", role: "client" },
          { name: "ClientTwo", role: "client" },
        ],
        "login",
        DATA_URL
      );
      expect(logs).toHaveLength(2);
      logs.forEach(l => {
        expect(l.type).toBe("login");
        expect(l.state).toBe("in_office");
      });
    });
  });

  describe("role directory", () => {
    it("loads suggestions from mock users", async () => {
      const suggestions = await getNameSuggestions();

      expect(suggestions).toEqual(
        expect.arrayContaining([
          { name: "Alice Vance", role: "staff" },
          { name: "Bob Smith", role: "staff" },
          { name: "Charlie Brown", role: "intern" },
        ])
      );
    });

    it("rejects an existing user submitted with the wrong role", async () => {
      await expect(
        createLog("Bob Smith", "logout", DATA_URL, "intern")
      ).rejects.toThrow("not registered as intern");
    });
  });

  describe("user CRUD operations", () => {
    describe("registerStaffOrIntern", () => {
      it("registers a new staff member", async () => {
        const user = await registerStaffOrIntern("Test Staff", "staff");
        expect(user.name).toBe("Test Staff");
        expect(user.role).toBe("staff");
        expect(user.state).toBe("out_of_office");

        const users = await getStaffInternUsers();
        expect(users).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: "Test Staff", role: "staff" })])
        );
      });

      it("registers a new intern", async () => {
        const user = await registerStaffOrIntern("Test Intern", "intern");
        expect(user.name).toBe("Test Intern");
        expect(user.role).toBe("intern");
        expect(user.state).toBe("out_of_office");
      });

      it("rejects empty name", async () => {
        await expect(
          registerStaffOrIntern("", "staff")
        ).rejects.toThrow("Please enter a name");
      });

      it("rejects duplicate registration", async () => {
        await registerStaffOrIntern("Unique Name", "staff");
        await expect(
          registerStaffOrIntern("Unique Name", "intern")
        ).rejects.toThrow("already exists");
      });
    });

    describe("renameUser", () => {
      it("renames a user", async () => {
        await registerStaffOrIntern("Jane Doe", "staff");
        const renamed = await renameUser("Jane Doe", "Jane Smith");
        expect(renamed.name).toBe("Jane Smith");
        expect(renamed.role).toBe("staff");

        const users = await getStaffInternUsers();
        expect(users.find((u) => u.name === "Jane Smith")).toBeTruthy();
        expect(users.find((u) => u.name === "Jane Doe")).toBeFalsy();
      });

      it("preserves old log entry names as historical archive after rename", async () => {
        await registerStaffOrIntern("History Name", "staff");
        await createLog("History Name", "login", DATA_URL, "staff");
        await createLog("History Name", "logout", DATA_URL, "staff");

        await renameUser("History Name", "History Renamed");

        const logsAfter = await getLogs(500);
        const oldLogs = logsAfter.filter((l) => l.name === "History Name");
        expect(oldLogs).toHaveLength(2);
        oldLogs.forEach((l) => {
          expect(l.name).toBe("History Name");
        });

        const users = await getStaffInternUsers();
        expect(users.find((u) => u.name === "History Renamed")).toBeTruthy();
        expect(users.find((u) => u.name === "History Name")).toBeFalsy();
      });

      it("does not create a duplicate user after rename", async () => {
        await registerStaffOrIntern("John Original", "staff");
        await renameUser("John Original", "John Renamed");

        const users = await getStaffInternUsers();
        const matches = users.filter((u) =>
          ["John Original", "John Renamed"].includes(u.name)
        );
        expect(matches).toHaveLength(1);
        expect(matches[0].name).toBe("John Renamed");
      });

      it("rejects rename to an existing name", async () => {
        await registerStaffOrIntern("User One", "staff");
        await registerStaffOrIntern("User Two", "intern");
        await expect(
          renameUser("User One", "User Two")
        ).rejects.toThrow("already exists");
      });

      it("rejects rename of non-existent user", async () => {
        await expect(
          renameUser("Nobody", "Somebody")
        ).rejects.toThrow("not found");
      });

      it("rejects rename to the same name", async () => {
        await registerStaffOrIntern("Same Name", "staff");
        await expect(
          renameUser("Same Name", "Same Name")
        ).rejects.toThrow("same as the current name");
      });
    });

    describe("deleteUser", () => {
      it("deletes a user", async () => {
        await registerStaffOrIntern("Delete Me", "staff");
        await deleteUser("Delete Me");

        const users = await getStaffInternUsers();
        expect(users.find((u) => u.name === "Delete Me")).toBeFalsy();
      });

      it("rejects delete of non-existent user", async () => {
        await expect(
          deleteUser("NonExistent")
        ).rejects.toThrow("not found");
      });

      it("only removes the targeted user", async () => {
        await registerStaffOrIntern("Kept User", "staff");
        await registerStaffOrIntern("Removed User", "intern");
        await deleteUser("Removed User");

        const users = await getStaffInternUsers();
        expect(users.find((u) => u.name === "Kept User")).toBeTruthy();
        expect(users.find((u) => u.name === "Removed User")).toBeFalsy();
      });
    });

    describe("updateUserRole", () => {
      it("changes a user role from staff to intern", async () => {
        await registerStaffOrIntern("Role Change", "staff");
        const updated = await updateUserRole("Role Change", "intern");
        expect(updated.role).toBe("intern");

        const users = await getStaffInternUsers();
        const match = users.find((u) => u.name === "Role Change");
        expect(match!.role).toBe("intern");
      });

      it("rejects update of non-existent user", async () => {
        await expect(
          updateUserRole("NonExistent", "staff")
        ).rejects.toThrow("not found");
      });
    });
  });

  describe("edge cases", () => {
    it("rejects empty name", async () => {
      await expect(
        createLog("", "login", DATA_URL, "guest")
      ).rejects.toThrow("Please enter your name");
    });

    it("rejects missing photo", async () => {
      await expect(
        createLog("NoPhoto", "login", "", "guest")
      ).rejects.toThrow("Please capture a photo first");
    });

    it("rejects empty people list", async () => {
      await expect(
        createMultipleLogs([], "login", DATA_URL)
      ).rejects.toThrow("add at least one person");
    });
  });
});
