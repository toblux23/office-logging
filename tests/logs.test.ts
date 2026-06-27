import { describe, it, expect, beforeEach } from "vitest";
import { createLog, createMultipleLogs } from "../lib/logs";

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

    it("cannot login as admin", async () => {
      await expect(
        createLog("NewAdmin", "login", DATA_URL, "admin")
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
