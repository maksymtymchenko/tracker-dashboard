import React from 'react';
import { ActivityItem, Paginated } from 'src/types';

interface Props {
  data: Paginated<ActivityItem> | null;
  loading: boolean;
  error?: string;
  onRefresh(): void;
  onPageChange?(page: number): void;
}

export function ActivityLog({ data, loading, error, onRefresh, onPageChange }: Props): JSX.Element {
  const [open, setOpen] = React.useState<ActivityItem | null>(null);
  const formatDuration = (ms: number): string => {
    if (!Number.isFinite(ms) || ms < 0) return String(ms);
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
    const minutes = Math.floor(seconds / 60);
    const remSec = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes}m ${remSec}s`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours}h ${remMin}m ${remSec}s`;
  };

  const renderDetailValue = (key: string, value: unknown): JSX.Element => {
    // Known key formatting
    if (key === 'url' && typeof value === 'string') {
      return (
        <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 break-all underline">
          {value}
        </a>
      );
    }
    if (key === 'title' && typeof value === 'string') {
      return <span className="font-medium break-words">{value}</span>;
    }
    if (key === 'reason' && typeof value === 'string') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">{value}</span>;
    }
    if (key === 'deviceId' && typeof value === 'string') {
      return <code className="text-xs break-all">{value}</code>;
    }
    if (key === 'clipboard' && typeof value === 'string') {
      return <pre className="text-xs whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800">{value}</pre>;
    }

    // Fallbacks
    if (typeof value === 'object' && value !== null) {
      try {
        return <span className="break-words">{JSON.stringify(value)}</span>;
      } catch {
        return <span className="break-words">{String(value)}</span>;
      }
    }
    return <span className="break-words">{String(value)}</span>;
  };
  return (
    <section className="p-4 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Activity Log</div>
        <div className="flex gap-2">
          <button className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700" onClick={onRefresh} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 dark:text-gray-400">
            <tr>
              {['Time', 'User', 'Department', 'Application', 'Domain/URL', 'Activity Type', 'Duration', 'Details', 'Actions'].map((h) => (
                <th key={h} className="py-2 pr-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && data?.items?.length
              ? data.items.map((row) => (
                  <tr
                    key={String(row._id) + row.time}
                    className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/70 dark:hover:bg-gray-900/60 transition-colors"
                  >
                    <td className="py-2 pr-4">{new Date(row.time).toLocaleString()}</td>
                    <td className="py-2 pr-4">{row.username}</td>
                    <td className="py-2 pr-4">{row.department || '—'}</td>
                    <td className="py-2 pr-4">{row.application || '—'}</td>
                    <td className="py-2 pr-4">{row.domain || row.url || '—'}</td>
                    <td className="py-2 pr-4">{row.type}</td>
                    <td className="py-2 pr-4">{row.duration ?? '—'}</td>
                    <td className="py-2 pr-4">{row.details ? '…' : '—'}</td>
                    <td className="py-2 pr-4">
                      <button
                        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
                        onClick={() => setOpen(row)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              : (
                <tr className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-6 pr-4 text-center text-gray-500 dark:text-gray-400" colSpan={9}>
                    {loading ? 'Loading…' : 'No data'}
                  </td>
                </tr>
                )}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div>
            Page {data.page} • {data.items.length} of {data.total}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
              disabled={loading || data.page <= 1}
              onClick={() => onPageChange && onPageChange(Math.max(1, data.page - 1))}
            >
              Prev
            </button>
            <button
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
              disabled={loading || data.page * data.limit >= data.total}
              onClick={() => onPageChange && onPageChange(data.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setOpen(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative max-w-3xl w-[92vw] max-h-[92vh] bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
              <div className="text-sm font-medium">Activity Details</div>
              <button className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700" onClick={() => setOpen(null)}>Close</button>
            </div>
            <div className="p-4 text-sm overflow-auto max-h-[80vh] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Time</div>
                  <div className="mt-0.5">{new Date(open.time).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500 dark:text-gray-400">User</div>
                  <div className="mt-0.5">{open.username}</div>
                </div>
                {open.department && (
                  <div>
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Department</div>
                    <div className="mt-0.5">{open.department}</div>
                  </div>
                )}
                {open.application && (
                  <div>
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Application</div>
                    <div className="mt-0.5">{open.application}</div>
                  </div>
                )}
                {(open.domain || open.url) && (
                  <div className="sm:col-span-2">
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Domain / URL</div>
                    {open.url ? (
                      <a href={open.url} target="_blank" rel="noreferrer" className="mt-0.5 text-blue-600 dark:text-blue-400 break-all underline">
                        {open.url}
                      </a>
                    ) : (
                      <div className="mt-0.5 break-all">{open.domain}</div>
                    )}
                  </div>
                )}
                <div>
                  <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Activity Type</div>
                  <div className="mt-0.5">{open.type}</div>
                </div>
                {typeof open.duration === 'number' && (
                  <div>
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Duration</div>
                    <div className="mt-0.5">{formatDuration(open.duration)}</div>
                  </div>
                )}
              </div>

              {open.details && (
                <div>
                  <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">Details</div>
                  <div className="rounded border border-gray-200 dark:border-gray-800 p-3 bg-gray-50 dark:bg-gray-950/50">
                    {typeof open.details === 'object' ? (
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        {Object.entries(open.details as Record<string, unknown>).map(([k, v]) => (
                          <div key={k} className="flex flex-col">
                            <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">{k}</dt>
                            <dd className="mt-0.5 break-words">{renderDetailValue(k, v)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <div className="text-sm break-words">{String(open.details)}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


