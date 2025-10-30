import React from 'react';

interface Props {
  events: number;
  users: number;
  screenshots: number;
  domains: number;
  loading?: boolean;
  error?: string;
}

export function KpiCards({ events, users, screenshots, domains, loading, error }: Props): JSX.Element {
  const items = [
    { label: 'Total Events', value: events },
    { label: 'Total Users', value: users },
    { label: 'Screenshots', value: screenshots },
    { label: 'Unique Domains', value: domains },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="p-4 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
        >
          <div className="text-sm text-gray-500 dark:text-gray-400">{it.label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{loading ? '…' : error ? '—' : it.value}</div>
        </div>
      ))}
    </div>
  );
}


