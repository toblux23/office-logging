"use client";

import { playClickSound } from "@/lib/audio";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  if (totalItems === 0 || totalPages <= 1) return null;

  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  function handlePageChange(page: number) {
    playClickSound();
    onPageChange(page);
  }

  function getPageNumbers(): (number | "ellipsis")[] {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    let start = Math.max(2, safePage - 1);
    let end = Math.min(totalPages - 1, safePage + 1);

    if (safePage <= 3) {
      start = 2;
      end = Math.min(maxVisible, totalPages - 1);
    } else if (safePage >= totalPages - 2) {
      start = Math.max(2, totalPages - maxVisible + 1);
      end = totalPages - 1;
    }

    if (start > 2) pages.push("ellipsis");

    for (let i = start; i <= end; i++) pages.push(i);

    if (end < totalPages - 1) pages.push("ellipsis");

    pages.push(totalPages);

    return pages;
  }

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-between border-t border-surface-200 px-5 py-3">
      <p className="text-[11px] font-semibold text-ink-400">
        Showing {startItem}–{endItem} of {totalItems} entries
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handlePageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-ink-600 transition hover:bg-surface-100 disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
        >
          Prev
        </button>

        {pageNumbers.map((page, idx) =>
          page === "ellipsis" ? (
            <span key={`ellipsis-${idx}`} className="px-1.5 text-[11px] text-ink-400">
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => handlePageChange(page)}
              className={`min-w-[28px] rounded-lg px-2 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                page === safePage
                  ? "bg-brand-blue-600 text-white shadow-sm"
                  : "text-ink-600 hover:bg-surface-100"
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => handlePageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-ink-600 transition hover:bg-surface-100 disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
        >
          Next
        </button>
      </div>
    </div>
  );
}
