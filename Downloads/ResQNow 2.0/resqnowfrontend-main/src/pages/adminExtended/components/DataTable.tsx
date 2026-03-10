import { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Column<T> = {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render?: (row: T) => ReactNode;
};

type PaginationInfo = {
  page: number;
  totalPages: number;
  total: number;
};

type DataTableProps<T> = {
  columns: Array<Column<T>>;
  data: T[];
  rowKey: keyof T | ((row: T, index: number) => string | number);
  loading?: boolean;
  emptyMessage?: string;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
};

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = "No records found.",
  pagination,
  onPageChange,
}: DataTableProps<T>) {
  const resolveRowKey = (row: T, index: number) => {
    if (typeof rowKey === "function") return rowKey(row, index);
    return String(row[rowKey] ?? index);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                    column.headerClassName || ""
                  }`.trim()}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="border-t border-slate-100">
                    {columns.map((column) => (
                      <td key={`${column.key}-${index}`} className="px-4 py-4">
                        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.map((row, index) => (
                  <tr key={resolveRowKey(row, index)} className="border-t border-slate-100 hover:bg-slate-50/60">
                    {columns.map((column) => (
                      <td
                        key={`${resolveRowKey(row, index)}-${column.key}`}
                        className={`px-4 py-3 align-top text-slate-700 ${column.className || ""}`.trim()}
                      >
                        {column.render ? column.render(row) : (row as Record<string, ReactNode>)[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && data.length === 0 ? (
        <div className="border-t border-slate-100 px-4 py-8 text-center text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      {pagination && onPageChange ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <p>
            Showing page {pagination.page} of {Math.max(pagination.totalPages, 1)} ({pagination.total} records)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onPageChange(Math.min(pagination.totalPages || 1, pagination.page + 1))}
              disabled={pagination.page >= (pagination.totalPages || 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
