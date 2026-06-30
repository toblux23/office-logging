import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import LogDetailModal from "@/components/admin/LogDetailModal";
import type { LogEntry } from "@/lib/supabase";

const mockLog: LogEntry = {
  id: "test-id-123",
  name: "Test Person",
  type: "login",
  role: "staff",
  state: "in_office",
  image_url: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
  created_at: "2025-06-15T10:30:00.000Z",
};

describe("LogDetailModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders log name", () => {
    render(<LogDetailModal log={mockLog} onClose={onClose} />);
    expect(screen.getByText("Test Person")).toBeInTheDocument();
  });

  it("renders action type badge", () => {
    render(<LogDetailModal log={mockLog} onClose={onClose} />);
    expect(screen.getByText("Log In")).toBeInTheDocument();
  });

  it("renders role", () => {
    render(<LogDetailModal log={mockLog} onClose={onClose} />);
    expect(screen.getByText("staff")).toBeInTheDocument();
  });

  it("renders the log image", () => {
    render(<LogDetailModal log={mockLog} onClose={onClose} />);
    const img = screen.getByAltText("Test Person");
    expect(img).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<LogDetailModal log={mockLog} onClose={onClose} />);
    const closeBtn = screen.getByLabelText("Close");
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when overlay is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<LogDetailModal log={mockLog} onClose={onClose} />);
    const overlay = container.firstChild as HTMLElement;
    await user.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", async () => {
    const user = userEvent.setup();
    render(<LogDetailModal log={mockLog} onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the modal content", async () => {
    const user = userEvent.setup();
    render(<LogDetailModal log={mockLog} onClose={onClose} />);
    const heading = screen.getByText("Log Entry Details");
    await user.click(heading);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders for logout type", () => {
    const logoutLog: LogEntry = { ...mockLog, type: "logout" };
    render(<LogDetailModal log={logoutLog} onClose={onClose} />);
    expect(screen.getByText("Log Out")).toBeInTheDocument();
  });

  it("renders for break type", () => {
    const breakLog: LogEntry = { ...mockLog, type: "break" };
    render(<LogDetailModal log={breakLog} onClose={onClose} />);
    expect(screen.getByText("Break")).toBeInTheDocument();
  });
});
