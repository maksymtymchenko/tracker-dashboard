import React from 'react';

interface HeaderProps {
  username?: string;
  role?: 'admin' | 'user';
  dark: boolean;
  onToggleDark(): void;
  onLogout(): void;
}

export function Header({ username, role, dark, onToggleDark, onLogout }: HeaderProps): JSX.Element {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/60 backdrop-blur sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-tight">Tracker Dashboard</span>
          {role && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 dark:text-blue-400">{role}</span>
          )}
          {username && <span className="text-xs text-gray-500 dark:text-gray-400">{username}</span>}
        </div>
        <div className="flex items-center gap-3">
          <button className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 transition-colors hover:border-gray-400 dark:hover:border-gray-600" onClick={onToggleDark}>
            {dark ? 'Light' : 'Dark'} Mode
          </button>
          <button className="text-sm px-3 py-1.5 rounded bg-red-600 text-white shadow-sm hover:shadow transition-all hover:-translate-y-0.5" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}


