import React, { useState, useEffect, useMemo } from 'react';
import { DepartmentUserAnalytics } from 'src/types';
import { fetchDepartmentUsersAnalytics } from 'src/api/client';

interface Props {
  departmentId: string | null;
  departmentName: string | null;
  selectedMetric: 'events' | 'duration' | 'users';
  onUserClick?(username: string): void;
}

export function DepartmentUserList({
  departmentId,
  departmentName,
  selectedMetric,
  onUserClick,
}: Props): JSX.Element | null {
  const [users, setUsers] = useState<DepartmentUserAnalytics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!departmentId) {
      setUsers([]);
      return;
    }

    const loadUsers = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const data = await fetchDepartmentUsersAnalytics(departmentId);
        setUsers(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [departmentId]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} s`;
    const minutes = Math.floor(seconds / 60);
    const remSec = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes}m ${remSec}s`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours}h ${remMin}m`;
  };

  const formatHours = (hours: number): string => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = Math.floor(hours / 24);
    const remHours = Math.round(hours % 24);
    return `${days}d ${remHours}h`;
  };

  // Sort users by selected metric
  const sortedUsers = useMemo(() => {
    const sorted = [...users];
    sorted.sort((a, b) => {
      if (selectedMetric === 'events') {
        return b.events - a.events;
      }
      if (selectedMetric === 'duration') {
        return b.duration - a.duration;
      }
      // For 'users' metric, sort by events as fallback
      return b.events - a.events;
    });
    return sorted;
  }, [users, selectedMetric]);

  if (!departmentId || !departmentName) return null;

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-medium text-base sm:text-lg">
            Users in {departmentName}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {sortedUsers.length} {sortedUsers.length === 1 ? 'user' : 'users'}
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      {loading ? (
        <div className="h-48 flex items-center justify-center text-gray-400">
          Loading users...
        </div>
      ) : sortedUsers.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-400">
          No users found in this department
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Events</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Domains</th>
                <th className="py-3 px-4">Websites</th>
                <th className="py-3 px-4">Apps</th>
                <th className="py-3 px-4">Screenshots</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr
                  key={user.username}
                  className={`border-b border-gray-100 dark:border-gray-800 transition-colors ${
                    onUserClick
                      ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/60'
                      : ''
                  }`}
                  onClick={() => {
                    if (onUserClick) {
                      onUserClick(user.username);
                    }
                  }}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium">
                      {user.displayName || user.username}
                    </div>
                    {user.displayName && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {user.username}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {user.events.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    {formatHours(user.duration / 3600000)}
                  </td>
                  <td className="py-3 px-4">{user.domains}</td>
                  <td className="py-3 px-4">{user.websites}</td>
                  <td className="py-3 px-4">{user.apps}</td>
                  <td className="py-3 px-4">{user.screenshots}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onUserClick && sortedUsers.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Click on a user to view their activity details
        </div>
      )}
    </div>
  );
}

