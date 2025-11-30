import React, { useState, useEffect, useCallback } from 'react';
import { ScreenshotItem } from 'src/types';
import { deleteScreenshot, bulkDeleteScreenshots, fetchScreenshots } from 'src/api/client';

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'user' | 'domain';

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

export function Screenshots({
  items,
  loading,
  error,
  onRefresh,
  page = 1,
  limit = 12,
  total = 0,
  onPageChange,
  usersOptions = [],
  userFilter = '',
  onUserFilterChange,
  userRole,
}: Props): JSX.Element {
  const [open, setOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showViewAll, setShowViewAll] = useState(false);
  const [allScreenshots, setAllScreenshots] = useState<ScreenshotItem[]>([]);
  const [allScreenshotsLoading, setAllScreenshotsLoading] = useState(false);
  const [allScreenshotsError, setAllScreenshotsError] = useState<string | undefined>();

  const isAdmin = userRole === 'admin';

  // Format timestamp for display
  const formatTime = (mtime?: number): string => {
    if (!mtime) return 'Unknown';
    const date = new Date(mtime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Sort and filter screenshots
  const processedItems = React.useMemo(() => {
    let filtered = [...items];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.filename.toLowerCase().includes(query) ||
          s.username.toLowerCase().includes(query) ||
          s.domain?.toLowerCase().includes(query),
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (b.mtime || 0) - (a.mtime || 0);
        case 'oldest':
          return (a.mtime || 0) - (b.mtime || 0);
        case 'user':
          return a.username.localeCompare(b.username);
        case 'domain':
          return (a.domain || '').localeCompare(b.domain || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [items, searchQuery, sortBy]);

  // Process all screenshots for View All modal (with search)
  const processedAllScreenshots = React.useMemo(() => {
    let filtered = [...allScreenshots];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.filename.toLowerCase().includes(query) ||
          s.username.toLowerCase().includes(query) ||
          s.domain?.toLowerCase().includes(query),
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (b.mtime || 0) - (a.mtime || 0);
        case 'oldest':
          return (a.mtime || 0) - (b.mtime || 0);
        case 'user':
          return a.username.localeCompare(b.username);
        case 'domain':
          return (a.domain || '').localeCompare(b.domain || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [allScreenshots, searchQuery, sortBy]);

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
      } else if (e.key === 'ArrowLeft') {
        const items = showViewAll && processedAllScreenshots.length > 0 
          ? processedAllScreenshots 
          : processedItems;
        const currentIdx = items.findIndex((s) => s.filename === open);
        if (currentIdx > 0) {
          setOpen(items[currentIdx - 1].filename);
        }
      } else if (e.key === 'ArrowRight') {
        const items = showViewAll && processedAllScreenshots.length > 0 
          ? processedAllScreenshots 
          : processedItems;
        const currentIdx = items.findIndex((s) => s.filename === open);
        if (currentIdx < items.length - 1) {
          setOpen(items[currentIdx + 1].filename);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, processedItems, processedAllScreenshots, showViewAll]);

  const handleDelete = async (filename: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteConfirm(filename);
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} screenshot(s)? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      await bulkDeleteScreenshots(Array.from(selected));
      setSelected(new Set());
      onRefresh();
    } catch (e: unknown) {
      console.error('Failed to delete screenshots:', e);
      alert(e instanceof Error ? e.message : 'Failed to delete screenshots');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteScreenshot(deleteConfirm);
      setDeleteConfirm(null);
      if (open === deleteConfirm) setOpen(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteConfirm);
        return next;
      });
      onRefresh();
    } catch (e: unknown) {
      console.error('Failed to delete screenshot:', e);
      alert(e instanceof Error ? e.message : 'Failed to delete screenshot');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (filename: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === processedItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(processedItems.map((s) => s.filename)));
    }
  };

  // Load all screenshots for View All modal
  const loadAllScreenshots = async () => {
    setAllScreenshotsError(undefined);
    setAllScreenshotsLoading(true);
    try {
      // Fetch with a high limit to get as many as possible
      const res = await fetchScreenshots({
        page: 1,
        limit: 1000,
        user: userFilter || undefined,
      });
      setAllScreenshots(res.items);
    } catch (e: unknown) {
      setAllScreenshotsError(e instanceof Error ? e.message : 'Failed to load screenshots');
    } finally {
      setAllScreenshotsLoading(false);
    }
  };

  const handleViewAll = () => {
    setShowViewAll(true);
    loadAllScreenshots();
  };

  // Use all screenshots for navigation if available, otherwise use current page items
  const navigationItems = showViewAll && processedAllScreenshots.length > 0 
    ? processedAllScreenshots 
    : processedItems;
  
  const currentScreenshot = navigationItems.find((s) => s.filename === open);
  const currentIndex = open ? navigationItems.findIndex((s) => s.filename === open) : -1;

  return (
    <section className="p-4 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="font-medium">Screenshots</div>
          <button
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors flex items-center gap-1.5"
            onClick={handleViewAll}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            View All
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent flex-1 min-w-[150px]"
          />

          {/* User Filter */}
          {usersOptions.length > 0 && (
            <select
              className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
              value={userFilter}
              onChange={(e) => onUserFilterChange && onUserFilterChange(e.target.value)}
            >
              <option value="">All Users</option>
              {usersOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}

          {/* Sort */}
          <select
            className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="user">By User</option>
            <option value="domain">By Domain</option>
          </select>

          {/* View Mode */}
          <div className="flex rounded border border-gray-300 dark:border-gray-700 overflow-hidden">
            <button
              className={`px-2 py-1.5 text-sm ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-transparent'}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              ⊞
            </button>
            <button
              className={`px-2 py-1.5 text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-transparent'}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              ☰
            </button>
          </div>

          {/* Bulk Actions */}
          {isAdmin && selected.size > 0 && (
            <button
              className="text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1.5 font-medium"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete ({selected.size})
            </button>
          )}

          <button
            className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      {/* Selection Header */}
      {isAdmin && processedItems.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <button
            className="text-blue-600 dark:text-blue-400 hover:underline"
            onClick={toggleSelectAll}
          >
            {selected.size === processedItems.length ? 'Deselect All' : 'Select All'}
          </button>
          {selected.size > 0 && (
            <span className="text-gray-500 dark:text-gray-400">
              {selected.size} selected
            </span>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {!loading && processedItems.length
            ? processedItems.map((s) => (
                <div key={s.filename} className="group relative">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selected.has(s.filename)}
                      onChange={() => toggleSelect(s.filename)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2 left-2 z-10 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  )}
                  <button
                    onClick={() => setOpen(s.filename)}
                    className="text-left w-full"
                  >
                    <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden ring-1 ring-transparent group-hover:ring-blue-300/40 transition-all relative">
                      <img
                        src={s.url || `/screenshots/${s.filename}`}
                        alt={s.filename}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (s.url && s.url !== `/screenshots/${s.filename}`) {
                            target.src = `/screenshots/${s.filename}`;
                          }
                        }}
                      />
                      {isAdmin && (
                        <button
                          onClick={(e) => handleDelete(s.filename, e)}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600/90 hover:scale-110 shadow-lg z-10"
                          title="Delete screenshot"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {s.username}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {formatTime(s.mtime)}
                      </div>
                      {s.domain && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {s.domain}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              ))
            : Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {!loading && processedItems.length
            ? processedItems.map((s) => (
                <div
                  key={s.filename}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group"
                >
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selected.has(s.filename)}
                      onChange={() => toggleSelect(s.filename)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  )}
                  <button
                    onClick={() => setOpen(s.filename)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <div className="w-24 h-16 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={s.url || `/screenshots/${s.filename}`}
                        alt={s.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (s.url && s.url !== `/screenshots/${s.filename}`) {
                            target.src = `/screenshots/${s.filename}`;
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{s.filename}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {s.username} • {formatTime(s.mtime)}
                      </div>
                      {s.domain && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                          {s.domain}
                        </div>
                      )}
                    </div>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => handleDelete(s.filename, e)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              ))
            : Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div>
          Showing {processedItems.length} of {total} screenshots • Page {page}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || page <= 1}
            onClick={() => onPageChange && onPageChange(Math.max(1, page - 1))}
          >
            Previous
          </button>
          <button
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || page * limit >= total}
            onClick={() => onPageChange && onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {open && currentScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setOpen(null)}
        >
          <div className="absolute inset-0 bg-black/80" />
          <div
            className="relative max-w-7xl w-[95vw] h-[95vh] bg-black/90 rounded-xl overflow-hidden shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentScreenshot.url || `/screenshots/${currentScreenshot.filename}`}
              alt={currentScreenshot.filename}
              className="w-full h-full object-contain"
            />

            {/* Navigation Arrows */}
            {navigationItems.length > 1 && (
              <>
                {currentIndex > 0 && (
                  <button
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(navigationItems[currentIndex - 1].filename);
                    }}
                  >
                    ←
                  </button>
                )}
                {currentIndex < navigationItems.length - 1 && (
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(navigationItems[currentIndex + 1].filename);
                    }}
                  >
                    →
                  </button>
                )}
              </>
            )}

            {/* Info Panel */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
              <div className="max-w-4xl mx-auto">
                <div className="text-white mb-2 font-medium">{currentScreenshot.filename}</div>
                <div className="flex flex-wrap gap-4 text-sm text-white/80">
                  <div>
                    <span className="text-white/60">User:</span> {currentScreenshot.username}
                  </div>
                  <div>
                    <span className="text-white/60">Time:</span> {formatTime(currentScreenshot.mtime)}
                  </div>
                  {currentScreenshot.domain && (
                    <div>
                      <span className="text-white/60">Domain:</span> {currentScreenshot.domain}
                    </div>
                  )}
                  {currentScreenshot.deviceId && (
                    <div>
                      <span className="text-white/60">Device:</span> {currentScreenshot.deviceId}
                    </div>
                  )}
                  {navigationItems.length > 1 && (
                    <div>
                      <span className="text-white/60">
                        {currentIndex + 1} of {navigationItems.length}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Controls */}
            <div className="absolute top-4 right-4 flex gap-2">
              {isAdmin && (
                <button
                  className="px-4 py-2 rounded-lg bg-red-600/90 hover:bg-red-600 text-white shadow-lg backdrop-blur-sm transition-all flex items-center gap-2 text-sm font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (open) {
                      const filenameToDelete = open;
                      setOpen(null);
                      setDeleteConfirm(filenameToDelete);
                    }
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
              <button
                className="px-4 py-2 rounded bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm text-sm"
                onClick={() => setOpen(null)}
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => !deleting && setDeleteConfirm(null)}
        >
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
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2 font-medium"
                onClick={confirmDelete}
                disabled={deleting}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View All Modal */}
      {showViewAll && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowViewAll(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 w-[95vw] h-[90vh] max-w-7xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="font-medium text-lg">All Screenshots ({processedAllScreenshots.length})</div>
              <button
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => setShowViewAll(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Filters */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search screenshots..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent flex-1 min-w-[200px]"
              />
              <select
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="user">By User</option>
                <option value="domain">By Domain</option>
              </select>
              {usersOptions.length > 0 && (
                <select
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent"
                  value={userFilter}
                  onChange={(e) => onUserFilterChange && onUserFilterChange(e.target.value)}
                >
                  <option value="">All Users</option>
                  {usersOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Modal Content - Scrollable Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {allScreenshotsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-400">Loading all screenshots...</div>
                </div>
              ) : allScreenshotsError ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-red-600">{allScreenshotsError}</div>
                </div>
              ) : processedAllScreenshots.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-400">No screenshots found</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {processedAllScreenshots.map((s) => (
                    <div key={s.filename} className="group relative">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          checked={selected.has(s.filename)}
                          onChange={() => toggleSelect(s.filename)}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-2 left-2 z-10 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      )}
                      <button
                        onClick={() => {
                          setShowViewAll(false);
                          setOpen(s.filename);
                        }}
                        className="text-left w-full"
                      >
                        <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden ring-1 ring-transparent group-hover:ring-blue-300/40 transition-all relative">
                          <img
                            src={s.url || `/screenshots/${s.filename}`}
                            alt={s.filename}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (s.url && s.url !== `/screenshots/${s.filename}`) {
                                target.src = `/screenshots/${s.filename}`;
                              }
                            }}
                          />
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(s.filename, e);
                              }}
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600/90 hover:scale-110 shadow-lg z-10"
                              title="Delete screenshot"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="mt-1.5 space-y-0.5">
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {s.username}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {formatTime(s.mtime)}
                          </div>
                          {s.domain && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {s.domain}
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
