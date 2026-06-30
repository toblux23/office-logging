import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SecurityAuditTable from "@/components/admin/SecurityAuditTable";
import type { AdminActivityLog } from "@/lib/supabase";

vi.mock("@/lib/audio", () => ({
  playClickSound: vi.fn(),
}));

function makeAuditLog(overrides: Partial<AdminActivityLog> = {}): AdminActivityLog {
  return {
    id: crypto.randomUUID(),
    action: "SIGN_IN",
    details: "Admin test sign in",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("SecurityAuditTable", () => {
  it("shows loading state", () => {
    render(<SecurityAuditTable logs={[]} loading={true} />);
    expect(screen.getByText(/Loading security activities/i)).toBeInTheDocument();
  });

  it("shows empty state when no logs", () => {
    render(<SecurityAuditTable logs={[]} loading={false} />);
    expect(screen.getByText(/No security audits found/i)).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<SecurityAuditTable logs={[makeAuditLog()]} loading={false} />);
    expect(screen.getByText("Timestamp")).toBeInTheDocument();
    expect(screen.getByText("Operation")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("renders audit log entries", () => {
    const log = makeAuditLog({
      action: "VIEW_LOGS",
      details: "Admin viewed logs",
    });
    render(<SecurityAuditTable logs={[log]} loading={false} />);
    expect(screen.getByText("VIEW_LOGS")).toBeInTheDocument();
    expect(screen.getByText("Admin viewed logs")).toBeInTheDocument();
  });

  it("renders multiple audit logs", () => {
    const logs = [
      makeAuditLog({ action: "SIGN_IN", details: "Sign in event" }),
      makeAuditLog({ action: "SIGN_OUT", details: "Sign out event" }),
    ];
    render(<SecurityAuditTable logs={logs} loading={false} />);
    expect(screen.getByText("SIGN_IN")).toBeInTheDocument();
    expect(screen.getByText("SIGN_OUT")).toBeInTheDocument();
  });

  it("paginates logs", () => {
    const logs = Array.from({ length: 15 }, (_, i) =>
      makeAuditLog({ action: `ACTION_${i}`, details: `Details ${i}` })
    );
    render(<SecurityAuditTable logs={logs} loading={false} />);
    for (let i = 0; i < 10; i++) {
      expect(screen.getByText(`ACTION_${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByText("ACTION_10")).not.toBeInTheDocument();
  });
});
