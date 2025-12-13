import React, { useEffect, useState } from 'react';
import { fetchActivity, listUserDepartments, listDepartments } from 'src/api/client';
import { ActivityItem, Paginated, Department, UserDepartment } from 'src/types';

interface Props {
  username: string | null;
  onClose(): void;
}

export function UserDetailsModal({ username, onClose }: Props): JSX.Element | null {
  const [userActivity, setUserActivity] = useState<Paginated<ActivityItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userDepartments, setUserDepartments] = useState<UserDepartment[]>([]);

  useEffect(() => {
    if (!username) return;

    const loadData = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const [activity, depts, userDepts] = await Promise.all([
          fetchActivity({ username, page: 1, limit: 20, timeRange: 'all' }),
          listDepartments(),
          listUserDepartments(),
        ]);
        setUserActivity(activity);
        setDepartments(depts);
        setUserDepartments(userDepts.filter((ud) => ud.username === username));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load user details');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [username]);

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

  const userDeptIds = userDepartments.map((ud) => ud.departmentId);
  const userDeptNames = departments
    .filter((d) => userDeptIds.includes(d._id))
    .map((d) => d.name);

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
        className="relative bg-white dark:bg-gray-900 rounded-xl p-6 shadow-2xl border border-gray-200 dark:border-gray-800 max-w-4xl w-[90vw] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-lg">User Details</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{username}</div>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {loading && <div className="text-center py-8 text-gray-400">Loading user details...</div>}
        {error && <div className="text-red-600 mb-4">{error}</div>}

        {!loading && !error && (
          <>
            {/* User Info */}
            <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">Username</div>
                  <div className="font-medium">{username}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">Departments</div>
                  <div className="font-medium">
                    {userDeptNames.length > 0 ? userDeptNames.join(', ') : 'No departments'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">Total Events</div>
                  <div className="font-medium">{userActivity?.total || 0}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">Recent Activity</div>
                  <div className="font-medium">{userActivity?.items.length || 0} items shown</div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <div className="font-medium mb-3">Recent Activity</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {['Time', 'Domain', 'Type', 'Duration'].map((h) => (
                        <th key={h} className="py-2 pr-4 text-left text-gray-500 dark:text-gray-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {userActivity?.items.length ? (
                      userActivity.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 pr-4">
                            {new Date(item.time).toLocaleString()}
                          </td>
                          <td className="py-2 pr-4">{item.domain || '—'}</td>
                          <td className="py-2 pr-4">{item.type || '—'}</td>
                          <td className="py-2 pr-4">{item.duration ? `${(item.duration / 1000).toFixed(1)}s` : '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-400">
                          No activity found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

