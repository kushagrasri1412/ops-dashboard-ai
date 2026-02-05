export default function Pagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
}) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  function toPage(nextPage) {
    if (nextPage < 1 || nextPage > totalPages) return;
    onPageChange(nextPage);
  }

  const windowSize = 5;
  const start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  const pages = [];
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span>Rows</span>
        <select
          aria-label="Rows per page"
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {(pageSizeOptions || [10, 20, 50]).map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="hidden text-sm text-slate-500 sm:inline">
          Page <span className="font-semibold text-slate-900">{page}</span> of{" "}
          <span className="font-semibold text-slate-900">{totalPages}</span>
        </span>
        <button
          type="button"
          onClick={() => toPage(page - 1)}
          disabled={!canPrev}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prev
        </button>

        <div className="flex items-center gap-1">
          {pages.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => toPage(pageNumber)}
              className={
                "h-9 w-9 rounded-lg text-sm font-semibold transition " +
                (pageNumber === page
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
              }
            >
              {pageNumber}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => toPage(page + 1)}
          disabled={!canNext}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
