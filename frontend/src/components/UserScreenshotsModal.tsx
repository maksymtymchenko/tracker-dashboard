import React, { useEffect, useState } from 'react';
import { fetchScreenshots } from 'src/api/client';
import { ScreenshotItem, Paginated } from 'src/types';

interface Props {
  username: string | null;
  onClose(): void;
  dateRange?: { start?: string; end?: string };
}

export function UserScreenshotsModal({ username, onClose, dateRange }: Props): JSX.Element | null {
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Reset page to 1 when username changes
  useEffect(() => {
    if (username) {
      setPage(1);
    }
  }, [username]);

  useEffect(() => {
    if (!username) return;

    const loadScreenshots = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const res = await fetchScreenshots({
          page,
          limit,
          user: username,
          timeRange: 'all',
          startDate: dateRange?.start,
          endDate: dateRange?.end,
        });
        setScreenshots(res.items);
        setTotal((res as any).total ?? (res as any).count ?? 0);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load screenshots');
      } finally {
        setLoading(false);
      }
    };

    loadScreenshots();
  }, [username, page, dateRange?.end, dateRange?.start]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (!username) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [username]);

  if (!username) return null;

  const totalPages = Math.ceil(total / limit);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center" 
      onClick={onClose}
    >
      <div 
        className="absolute inset-0 bg-black/60"
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-xl p-6 shadow-2xl border border-gray-200 dark:border-gray-800 max-w-6xl w-[90vw] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-lg">User Screenshots</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{username}</div>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {loading && <div className="text-center py-8 text-gray-400">Loading screenshots...</div>}
        {error && <div className="text-red-600 mb-4">{error}</div>}

        {!loading && !error && (
          <>
            {screenshots.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No screenshots found for this user</div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  Showing {screenshots.length} of {total} screenshots
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {screenshots.map((shot) => (
                    <div
                      key={shot.filename}
                      className="relative group cursor-pointer rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
                    >
                      {shot.url ? (
                        <a href={shot.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={shot.url}
                            alt={shot.filename}
                            className="w-full h-48 object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        </a>
                      ) : (
                        <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <div className="text-xs text-gray-400 text-center px-2">
                            {shot.filename}
                          </div>
                        </div>
                      )}
                      <div className="p-2 bg-white dark:bg-gray-900">
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {shot.domain || 'No domain'}
                        </div>
                        {shot.createdAt && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(shot.createdAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Page {page} of {totalPages}
                    </div>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
