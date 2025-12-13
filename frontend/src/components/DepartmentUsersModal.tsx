import React, { useEffect, useState } from 'react';
import { getUsersByDepartment, listDepartments } from 'src/api/client';
import { Department } from 'src/types';

interface Props {
  departmentId: string | null;
  departmentName: string | null;
  onClose(): void;
  onUserClick(username: string): void;
}

export function DepartmentUsersModal({ departmentId, departmentName, onClose, onUserClick }: Props): JSX.Element | null {
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [department, setDepartment] = useState<Department | null>(null);

  useEffect(() => {
    if (!departmentId) return;

    const loadData = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const [usersList, departments] = await Promise.all([
          getUsersByDepartment(departmentId),
          listDepartments(),
        ]);
        setUsers(usersList);
        const dept = departments.find((d) => d._id === departmentId);
        setDepartment(dept || null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load department users');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [departmentId]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (!departmentId) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [departmentId]);

  if (!departmentId || !departmentName) return null;

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
        className="relative bg-white dark:bg-gray-900 rounded-xl p-6 shadow-2xl border border-gray-200 dark:border-gray-800 max-w-2xl w-[90vw] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-lg">Department Users</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {departmentName}
              {department && department.color && (
                <span
                  className="ml-2 inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: department.color }}
                />
              )}
            </div>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {loading && <div className="text-center py-8 text-gray-400">Loading users...</div>}
        {error && <div className="text-red-600 mb-4">{error}</div>}

        {!loading && !error && (
          <>
            {users.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No users found in this department</div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {users.length} {users.length === 1 ? 'user' : 'users'} in this department
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {users.map((username) => (
                    <button
                      key={username}
                      className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all text-left cursor-pointer"
                      onClick={() => {
                        onUserClick(username);
                        onClose();
                      }}
                    >
                      <div className="font-medium">{username}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click to view details</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

