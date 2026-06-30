import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import FilterBar from "@/components/admin/FilterBar";

vi.mock("@/lib/audio", () => ({
  playClickSound: vi.fn(),
}));

describe("FilterBar", () => {
  const defaultProps = {
    search: "",
    dateFrom: "",
    dateTo: "",
    typeFilter: "all" as const,
    roleFilter: "all" as const,
    sortBy: "date-desc" as const,
    totalLogs: 100,
    visibleCount: 50,
    hasFilters: false,
    nameSuggestions: [
      { name: "Alice Vance", role: "staff" as const },
      { name: "Bob Smith", role: "staff" as const },
    ],
    onSearchChange: vi.fn(),
    onDateFromChange: vi.fn(),
    onDateToChange: vi.fn(),
    onTypeFilterChange: vi.fn(),
    onRoleFilterChange: vi.fn(),
    onSortByChange: vi.fn(),
    onClearFilters: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all filter labels", () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Search name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("From date")).toBeInTheDocument();
    expect(screen.getByText("To date")).toBeInTheDocument();
    expect(screen.getByText("Sort by")).toBeInTheDocument();
  });

  it("shows visible/total count text", () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText(/50 of 100 entries matching search query/i)).toBeInTheDocument();
  });

  it("does not show clear filters button when no filters are active", () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.queryByText("Clear all filters")).not.toBeInTheDocument();
  });

  it("shows clear filters button when filters are active", () => {
    render(<FilterBar {...defaultProps} hasFilters={true} />);
    expect(screen.getByText("Clear all filters")).toBeInTheDocument();
  });

  it("calls onClearFilters when clear button is clicked", async () => {
    const onClearFilters = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} hasFilters={true} onClearFilters={onClearFilters} />);
    await user.click(screen.getByText("Clear all filters"));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("calls onRoleFilterChange when role is changed", async () => {
    const onRoleFilterChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} onRoleFilterChange={onRoleFilterChange} />);
    await user.selectOptions(screen.getByLabelText("Role"), "staff");
    expect(onRoleFilterChange).toHaveBeenCalledWith("staff");
  });

  it("calls onTypeFilterChange when type is changed", async () => {
    const onTypeFilterChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} onTypeFilterChange={onTypeFilterChange} />);
    await user.selectOptions(screen.getByLabelText("Type"), "login");
    expect(onTypeFilterChange).toHaveBeenCalledWith("login");
  });

  it("calls onSortByChange when sort is changed", async () => {
    const onSortByChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} onSortByChange={onSortByChange} />);
    await user.selectOptions(screen.getByLabelText("Sort by"), "name-asc");
    expect(onSortByChange).toHaveBeenCalledWith("name-asc");
  });

  it("calls onSearchChange when search input changes", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} onSearchChange={onSearchChange} />);
    await user.type(screen.getByPlaceholderText(/e.g. Alex/i), "A");
    expect(onSearchChange).toHaveBeenCalledWith("A");
  });

  it("calls onDateFromChange when from date changes", async () => {
    const onDateFromChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} onDateFromChange={onDateFromChange} />);
    const fromInput = screen.getByLabelText("From date");
    await user.type(fromInput, "2025-01-01");
    expect(onDateFromChange).toHaveBeenCalled();
  });

  it("shows suggestions dropdown when search is focused", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/e.g. Alex/i);
    await user.click(searchInput);
    expect(screen.getByText("Alice Vance")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
  });

  it("filters suggestions by search term", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} search="Bob" />);
    const searchInput = screen.getByPlaceholderText(/e.g. Alex/i);
    await user.click(searchInput);
    expect(screen.queryByText("Alice Vance")).not.toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
  });

  it("selecting a suggestion calls onSearchChange with the name", async () => {
    const onSearchChange = vi.fn();
    const onRoleFilterChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterBar
        {...defaultProps}
        onSearchChange={onSearchChange}
        onRoleFilterChange={onRoleFilterChange}
      />
    );
    const searchInput = screen.getByPlaceholderText(/e.g. Alex/i);
    await user.click(searchInput);
    await user.click(screen.getByText("Alice Vance"));
    expect(onSearchChange).toHaveBeenCalledWith("Alice Vance");
    expect(onRoleFilterChange).toHaveBeenCalledWith("staff");
  });

  it("does not show suggestions when list is empty", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} nameSuggestions={[]} />);
    const searchInput = screen.getByPlaceholderText(/e.g. Alex/i);
    await user.click(searchInput);
    expect(screen.queryByText("Alice Vance")).not.toBeInTheDocument();
  });
});
