import React, { useState } from 'react';
import { ScreenshotItem } from 'src/types';
import { deleteScreenshot } from 'src/api/client';

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
  userRole?: 'admin' | 'user';
}

export function Screenshots({ items, loading, error, onRefresh, page = 1, limit = 12, total = 0, onPageChange, usersOptions = [], userFilter = '', onUserFilterChange, userRole }: Props): JSX.Element {
  const [open, setOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm(filename);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteScreenshot(deleteConfirm);
      setDeleteConfirm(null);
      onRefresh();
    } catch (e: unknown) {
      console.error('Failed to delete screenshot:', e);
      alert(e instanceof Error ? e.message : 'Failed to delete screenshot');
    } finally {
      setDeleting(false);
    }
  };

  const isAdmin = userRole === 'admin';
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
              <div key={s.filename} className="group relative">
                <button onClick={() => setOpen(s.filename)} className="text-left w-full">
                  <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden ring-1 ring-transparent group-hover:ring-blue-300/40 transition-all relative">
                    <img
                      src={s.url || `/screenshots/${s.filename}`}
                      alt={s.filename}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      onError={(e) => {
                        // Fallback to relative path if R2 URL fails
                        const target = e.target as HTMLImageElement;
                        if (s.url && s.url !== `/screenshots/${s.filename}`) {
                          target.src = `/screenshots/${s.filename}`;
                        }
                      }}
                    />
                    {isAdmin && (
                      <button
                        onClick={(e) => handleDelete(s.filename, e)}
                        className="absolute top-1 right-1 p-1 rounded bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:bg-red-700 shadow-lg z-10"
                        title="Delete screenshot"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">{s.username}</div>
                </button>
              </div>
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
            <img 
              src={items.find(s => s.filename === open)?.url || `/screenshots/${open}`} 
              alt={open} 
              className="w-full h-full object-contain" 
            />
            <div className="absolute top-2 right-2 flex gap-2">
              {isAdmin && (
                <button
                  className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 shadow-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (open) {
                      const filenameToDelete = open;
                      setOpen(null);
                      setDeleteConfirm(filenameToDelete);
                    }
                  }}
                >
                  Delete
                </button>
              )}
              <button className="text-xs px-3 py-1.5 rounded bg-white/90 text-gray-900 hover:bg-white" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-white dark:bg-gray-900 rounded-xl p-6 shadow-2xl border border-gray-200 dark:border-gray-800 max-w-md w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-medium mb-2">Delete Screenshot</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete this screenshot? This action cannot be undone.
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="text-sm px-4 py-2 rounded border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="text-sm px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


