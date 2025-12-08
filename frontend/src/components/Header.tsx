import React from 'react';

interface HeaderProps {
  username?: string;
  role?: 'admin' | 'user';
  dark: boolean;
  onToggleDark(): void;
  onLogout(): void;
  onManageDepartments?(): void;
  onManageUsers?(): void;
}

export function Header({ username, role, dark, onToggleDark, onLogout, onManageDepartments, onManageUsers }: HeaderProps): JSX.Element {
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
          {onManageDepartments && (
            <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors" onClick={onManageDepartments}>
              Manage Departments
            </button>
          )}
          {onManageUsers && (
            <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors" onClick={onManageUsers}>
              Manage Users
            </button>
          )}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={dark}
              onChange={onToggleDark}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
              {dark ? 'Dark' : 'Light'}
            </span>
          </label>
          <button className="text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white shadow-sm hover:shadow transition-all hover:-translate-y-0.5" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}


