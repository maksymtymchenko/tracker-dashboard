import React, { useEffect, useMemo, useState } from 'react';
import { BasicUser } from 'src/types';
import { listUsers, listDistinctUsers, deleteUserById, adminDeleteUserAllData, updateUser, setUserDisplayNameByUsername, fetchUsersAnalytics } from 'src/api/client';

interface Props {
  open: boolean;
  onClose(): void;
  canManage: boolean;
}

export function AdminUsers({ open, onClose, canManage }: Props): JSX.Element | null {
  const [users, setUsers] = useState<BasicUser[]>([]);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});

  const load = async () => {
    if (!canManage) return;
    setLoading(true);
    setError(undefined);
    try {
      // Prefer distinct usernames from events (works for non-admin viewers too)
      const [names, adminUsers, analyticsUsers] = await Promise.all([
        listDistinctUsers(),
        listUsers().catch(() => [] as BasicUser[]),
        fetchUsersAnalytics().catch(() => []),
      ]);
      const dn: Record<string, string> = {};
      analyticsUsers.forEach((u) => {
        if (u.displayName) dn[u.username] = u.displayName;
      });
      setDisplayNames(dn);
      setUsernames(names);
      setUsers(adminUsers);
      setPage(1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && canManage) {
      load();
    }
  }, [open, canManage]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (!open) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [open]);

  const pageItems = useMemo(() => {
    const list = usernames.length ? usernames : users.map((u) => u.username);
    const start = (page - 1) * limit;
    return list.slice(start, start + limit);
  }, [users, usernames, page, limit]);

  if (!open || !canManage) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div 
        className="absolute inset-0 bg-black/40" 
        onClick={onClose}
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />
      <div className="relative w-full max-w-5xl max-h-[80vh] overflow-hidden overflow-y-auto bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="font-semibold">Manage Users</div>
          <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700" onClick={onClose}>Close</button>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors" onClick={load} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>
          {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="py-2 px-2 text-left">Name</th>
              <th className="py-2 px-2 text-left">Username</th>
              <th className="py-2 px-2 text-left">Role</th>
              <th className="py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((uname) => {
              const adminUser = users.find((x) => x.username === uname);
              const display = displayNames[uname] || adminUser?.displayName || uname;
              return (
              <tr key={uname} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/70 dark:hover:bg-gray-900/60 transition-colors">
                <td className="py-2 px-2">
                  <div className="font-medium">{display}</div>
                </td>
                <td className="py-2 px-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{uname}</span>
                </td>
                <td className="py-2 px-2">{adminUser?.role ?? '—'}</td>
                <td className="py-2 px-2 text-right space-x-2">
                  <button
                    className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                    onClick={async () => {
                      if (!confirm(`Delete ALL data for ${uname}? This cannot be undone.`)) return;
                      setLoading(true);
                      try {
                        await adminDeleteUserAllData(uname);
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Failed to delete user data');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Delete Data
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                    onClick={async () => {
                      const current = adminUser?.displayName || '';
                      const next = window.prompt(`Set display name for ${uname}`, current);
                      if (next === null) return;
                      const value = next.trim();
                      setLoading(true);
                      try {
                        if (adminUser?._id) {
                          await updateUser(adminUser._id, { displayName: value || undefined });
                        } else if (value) {
                          await setUserDisplayNameByUsername(uname, value);
                        }
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Failed to update display name');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Set Name
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                    onClick={async () => {
                      if (!confirm(`Delete user ${uname}?`)) return;
                      if (!adminUser?._id) {
                        setError('No account found for this username. Use "Delete Data" to remove activity/screenshots.');
                        return;
                      }
                      setLoading(true);
                      try {
                        await deleteUserById(adminUser._id);
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Failed to delete user');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Delete User
                  </button>
                </td>
              </tr>
            )})}
            {!pageItems.length && (
              <tr className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-6 px-2 text-center text-gray-500 dark:text-gray-400" colSpan={4}>
                  {loading ? 'Loading…' : 'No users'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800">
          <div>Page {page}</div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </button>
            <button
              className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700"
              onClick={() => {
                const total = (usernames.length ? usernames : users.map((u) => u.username)).length;
                const maxPage = Math.max(1, Math.ceil(total / limit));
                setPage((p) => Math.min(maxPage, p + 1));
              }}
              disabled={(() => {
                const total = (usernames.length ? usernames : users.map((u) => u.username)).length;
                return page * limit >= total;
              })()}
            >
              Next
            </button>
          </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}


