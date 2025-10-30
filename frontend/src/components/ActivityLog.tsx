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
                      <button className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors">View</button>
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
    </section>
  );
}


