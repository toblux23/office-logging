import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AttendanceTable from "@/components/admin/AttendanceTable";
import type { LogEntry } from "@/lib/supabase";

vi.mock("@/lib/audio", () => ({
  playClickSound: vi.fn(),
}));

vi.mock("@/lib/logs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/logs")>("@/lib/logs");
  return {
    ...actual,
    calculateStreak: vi.fn(() => 0),
  };
});

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: crypto.randomUUID(),
    name: "Test User",
    type: "login",
    role: "staff",
    state: "in_office",
    image_url: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("AttendanceTable", () => {
  const onSelectLog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    render(
      <AttendanceTable logs={[]} visibleLogs={[]} loading={true} onSelectLog={onSelectLog} />
    );
    expect(screen.getByText(/Loading attendance logs database/i)).toBeInTheDocument();
  });

  it("shows empty state when no logs", () => {
    render(
      <AttendanceTable logs={[]} visibleLogs={[]} loading={false} onSelectLog={onSelectLog} />
    );
    expect(screen.getByText(/No entries recorded in database yet/i)).toBeInTheDocument();
  });

  it("shows no-matches state when visibleLogs is empty but logs exist", () => {
    render(
      <AttendanceTable
        logs={[makeLog()]}
        visibleLogs={[]}
        loading={false}
        onSelectLog={onSelectLog}
      />
    );
    expect(screen.getByText(/No entries match your dashboard filters/i)).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(
      <AttendanceTable
        logs={[makeLog()]}
        visibleLogs={[makeLog()]}
        loading={false}
        onSelectLog={onSelectLog}
      />
    );
    expect(screen.getByText("Photo")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("Streak / Badges")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Inspect")).toBeInTheDocument();
  });

  it("renders log entries", () => {
    const log = makeLog({ name: "Display User", role: "intern", type: "login" });
    render(
      <AttendanceTable
        logs={[log]}
        visibleLogs={[log]}
        loading={false}
        onSelectLog={onSelectLog}
      />
    );
    expect(screen.getByText("Display User")).toBeInTheDocument();
    expect(screen.getByText("intern")).toBeInTheDocument();
    expect(screen.getByText("Log In")).toBeInTheDocument();
  });

  it("calls onSelectLog when a row is clicked", async () => {
    const user = userEvent.setup();
    const log = makeLog({ name: "Clickable User" });
    render(
      <AttendanceTable
        logs={[log]}
        visibleLogs={[log]}
        loading={false}
        onSelectLog={onSelectLog}
      />
    );
    await user.click(screen.getByText("Clickable User"));
    expect(onSelectLog).toHaveBeenCalledWith(log);
  });

  it("calls onSelectLog when eye icon is clicked", async () => {
    const user = userEvent.setup();
    const log = makeLog({ name: "Eye User" });
    render(
      <AttendanceTable
        logs={[log]}
        visibleLogs={[log]}
        loading={false}
        onSelectLog={onSelectLog}
      />
    );
    const eyeBtn = screen.getByLabelText(/View Eye User's entry/i);
    await user.click(eyeBtn);
    expect(onSelectLog).toHaveBeenCalledWith(log);
  });

  it("paginates logs and shows only page-sized chunks", () => {
    const logs = Array.from({ length: 15 }, (_, i) =>
      makeLog({ name: `User ${i + 1}` })
    );
    render(
      <AttendanceTable
        logs={logs}
        visibleLogs={logs}
        loading={false}
        onSelectLog={onSelectLog}
      />
    );
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(`User ${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByText("User 11")).not.toBeInTheDocument();
  });

  it("renders pagination component for multiple pages", () => {
    const logs = Array.from({ length: 25 }, (_, i) =>
      makeLog({ name: `User ${i + 1}` })
    );
    render(
      <AttendanceTable
        logs={logs}
        visibleLogs={logs}
        loading={false}
        onSelectLog={onSelectLog}
      />
    );
    expect(screen.getByText(/Showing 1–10 of 25 entries/i)).toBeInTheDocument();
  });

  it("renders role with default 'intern' fallback when role is missing", () => {
    const log = makeLog({ name: "No Role", role: undefined as any });
    render(
      <AttendanceTable
        logs={[log]}
        visibleLogs={[log]}
        loading={false}
        onSelectLog={onSelectLog}
      />
    );
    expect(screen.getByText("intern")).toBeInTheDocument();
  });
});
