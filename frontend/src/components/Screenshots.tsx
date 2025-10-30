import React from 'react';
import { ScreenshotItem } from 'src/types';

interface Props {
  items: ScreenshotItem[];
  loading: boolean;
  error?: string;
  onRefresh(): void;
  page?: number;
  limit?: number;
  total?: number;
  onPageChange?(page: number): void;
  usersOptions?: string[];
  userFilter?: string;
  onUserFilterChange?(username: string): void;
}

export function Screenshots({ items, loading, error, onRefresh, page = 1, limit = 12, total = 0, onPageChange, usersOptions = [], userFilter = '', onUserFilterChange }: Props): JSX.Element {
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <section className="p-4 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Screenshots</div>
        <div className="flex gap-2 items-center">
          {usersOptions.length > 0 && (
            <select
              className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
              value={userFilter}
              onChange={(e) => onUserFilterChange && onUserFilterChange(e.target.value)}
            >
              <option value="">All Users</option>
              {usersOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          )}
          <button className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700" onClick={onRefresh} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {!loading && items.length
          ? items.map((s) => (
              <button key={s.filename} onClick={() => setOpen(s.filename)} className="group text-left">
                <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden ring-1 ring-transparent group-hover:ring-blue-300/40 transition-all">
                  <img
                    src={`/screenshots/${s.filename}`}
                    alt={s.filename}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">{s.username}</div>
              </button>
            ))
          : Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div>
          Page {page} • {items.length} of {total}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
            disabled={loading || page <= 1}
            onClick={() => onPageChange && onPageChange(Math.max(1, page - 1))}
          >
            Prev
          </button>
          <button
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
            disabled={loading || page * limit >= total}
            onClick={() => onPageChange && onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setOpen(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative max-w-6xl w-[92vw] h-[92vh] bg-black/80 rounded-xl overflow-hidden shadow-2xl border border-white/10">
            <img src={`/screenshots/${open}`} alt={open} className="w-full h-full object-contain" />
            <button className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-white/90 text-gray-900" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}


