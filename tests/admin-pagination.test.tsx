import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Pagination from "@/components/admin/Pagination";

vi.mock("@/lib/audio", () => ({
  playClickSound: vi.fn(),
}));

describe("Pagination", () => {
  const onPageChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when totalItems is 0", () => {
    const { container } = render(
      <Pagination currentPage={1} totalItems={0} pageSize={10} onPageChange={onPageChange} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when totalPages is 1", () => {
    const { container } = render(
      <Pagination currentPage={1} totalItems={5} pageSize={10} onPageChange={onPageChange} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders page information text", () => {
    render(
      <Pagination currentPage={1} totalItems={25} pageSize={10} onPageChange={onPageChange} />
    );
    expect(screen.getByText(/Showing 1–10 of 25 entries/i)).toBeInTheDocument();
  });

  it("renders correct page number buttons", () => {
    render(
      <Pagination currentPage={1} totalItems={25} pageSize={10} onPageChange={onPageChange} />
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("disables Previous button on first page", () => {
    render(
      <Pagination currentPage={1} totalItems={25} pageSize={10} onPageChange={onPageChange} />
    );
    expect(screen.getByText("Prev")).toBeDisabled();
  });

  it("disables Next button on last page", () => {
    render(
      <Pagination currentPage={3} totalItems={25} pageSize={10} onPageChange={onPageChange} />
    );
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("calls onPageChange with correct page when a number is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Pagination currentPage={1} totalItems={25} pageSize={10} onPageChange={onPageChange} />
    );
    await user.click(screen.getByText("2"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange when Next is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Pagination currentPage={1} totalItems={25} pageSize={10} onPageChange={onPageChange} />
    );
    await user.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange when Prev is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Pagination currentPage={2} totalItems={25} pageSize={10} onPageChange={onPageChange} />
    );
    await user.click(screen.getByText("Prev"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("highlights the current page", () => {
    render(
      <Pagination currentPage={2} totalItems={25} pageSize={10} onPageChange={onPageChange} />
    );
    const page2Btn = screen.getByText("2");
    expect(page2Btn.className).toContain("bg-brand-blue-600");
  });

  it("shows correct item range on last page", () => {
    render(
      <Pagination currentPage={3} totalItems={25} pageSize={10} onPageChange={onPageChange} />
    );
    expect(screen.getByText(/Showing 21–25 of 25 entries/i)).toBeInTheDocument();
  });

  it("renders ellipsis for many pages", () => {
    render(
      <Pagination currentPage={5} totalItems={100} pageSize={10} onPageChange={onPageChange} />
    );
    const ellipses = screen.getAllByText("…");
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });
});
