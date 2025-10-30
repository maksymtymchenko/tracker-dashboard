import React, { useEffect, useMemo, useState } from 'react';
import {
  listDepartments,
  createDepartment,
  updateDepartment as apiUpdateDepartment,
  deleteDepartment as apiDeleteDepartment,
  listUserDepartments,
  assignUserDepartment as apiAssign,
  unassignUserDepartment as apiUnassign,
  listUsers,
  listDistinctUsers,
} from 'src/api/client';
import { Department, UserDepartment, BasicUser } from 'src/types';

interface Props {
  open: boolean;
  onClose(): void;
}

export function DepartmentsModal({ open, onClose }: Props): JSX.Element | null {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userDepts, setUserDepts] = useState<UserDepartment[]>([]);
  const [users, setUsers] = useState<BasicUser[]>([]);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [usersPage, setUsersPage] = useState<number>(1);
  const [usersLimit] = useState<number>(10);
  const [form, setForm] = useState<Partial<Department>>({ name: '', color: '#3b82f6', description: '' });
  const [selectedDeptId, setSelectedDeptId] = useState<string | undefined>();
  const [assignUser, setAssignUser] = useState<string>('');
  const [assignDept, setAssignDept] = useState<string>('');

  const usernameToDeptIds = useMemo(() => {
    const map = new Map<string, string[]>();
    userDepts.forEach((ud) => {
      const arr = map.get(ud.username) || [];
      arr.push(ud.departmentId);
      map.set(ud.username, arr);
    });
    return map;
  }, [userDepts]);

  const load = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [deps, uds, us, names] = await Promise.all([
        listDepartments(),
        listUserDepartments(),
        // admin users (may fail if not admin)
        listUsers().catch(() => [] as BasicUser[]),
        // distinct usernames from events
        listDistinctUsers(),
      ]);
      setDepartments(deps);
      setUserDepts(uds);
      setUsers(us);
      setUsernames(names);
      if (!assignDept && deps[0]?._id) setAssignDept(deps[0]._id);
      setUsersPage(1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!open) return null;

  const createOrUpdate = async () => {
    if (!form.name) return;
    setLoading(true);
    try {
      if (selectedDeptId) {
        await apiUpdateDepartment(selectedDeptId, { name: form.name, color: form.color, description: form.description });
      } else {
        await createDepartment({ name: form.name, color: form.color, description: form.description });
      }
      setForm({ name: '', color: '', description: '' });
      setSelectedDeptId(undefined);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const edit = (d: Department) => {
    setSelectedDeptId(d._id);
    setForm({ name: d.name, color: d.color, description: d.description });
  };

  const remove = async (id: string) => {
    setLoading(true);
    try {
      await apiDeleteDepartment(id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const assign = async () => {
    if (!assignUser || !assignDept) return;
    setLoading(true);
    try {
      await apiAssign({ username: assignUser, departmentId: assignDept });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to assign');
    } finally {
      setLoading(false);
    }
  };

  const unassign = async (username: string, departmentId: string) => {
    setLoading(true);
    try {
      await apiUnassign({ username, departmentId });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to unassign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[80vh] overflow-hidden overflow-y-auto bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="font-semibold">Manage Departments</div>
          <button className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700" onClick={onClose}>Close</button>
        </div>
        <div className="p-4 space-y-6">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="font-medium">Departments</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                <input className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent" placeholder="Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <div className="flex items-center gap-2 min-w-0">
                  <input type="color" className="h-8 w-8 shrink-0 p-0 bg-transparent border border-gray-300 dark:border-gray-700 rounded" value={form.color || '#3b82f6'} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                  <input className="flex-1 min-w-0 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent" placeholder="#hex color" value={form.color || ''} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </div>
                <input className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent" placeholder="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <button className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700" onClick={createOrUpdate} disabled={loading}>{selectedDeptId ? 'Update' : 'Create'}</button>
                {selectedDeptId && (
                  <button className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700" onClick={() => { setSelectedDeptId(undefined); setForm({ name: '', color: '', description: '' }); }}>Cancel</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'Engineering', color: '#3b82f6' },
                  { name: 'Marketing', color: '#f59e0b' },
                  { name: 'Sales', color: '#10b981' },
                  { name: 'Support', color: '#ef4444' },
                ].map((d) => (
                  <button key={d.name} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700" onClick={() => setForm({ ...form, name: d.name, color: d.color })}>
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded" style={{ background: d.color }} />{d.name}</span>
                  </button>
                ))}
                <button
                  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const defaults = [
                        { name: 'Engineering', color: '#3b82f6' },
                        { name: 'Marketing', color: '#f59e0b' },
                        { name: 'Sales', color: '#10b981' },
                        { name: 'Support', color: '#ef4444' },
                      ];
                      for (const d of defaults) await createDepartment(d);
                      await load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to add defaults');
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Add defaults
                </button>
              </div>
              <div className="mt-3 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 px-2 text-left">Name</th>
                      <th className="py-2 px-2 text-left">Color</th>
                      <th className="py-2 px-2 text-left">Description</th>
                      <th className="py-2 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((d) => (
                      <tr key={d._id} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-2 px-2">{d.name}</td>
                        <td className="py-2 px-2"><span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: d.color || '#9ca3af' }} />{d.color || '—'}</span></td>
                        <td className="py-2 px-2">{d.description || '—'}</td>
                        <td className="py-2 px-2 text-right space-x-2">
                          <button className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700" onClick={() => edit(d)}>Edit</button>
                          <button className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700" onClick={() => remove(d._id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <div className="font-medium">User Assignments</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <select className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent" value={assignUser} onChange={(e) => setAssignUser(e.target.value)}>
                  <option value="">Select User</option>
                  {(usernames.length ? usernames : users.map((u) => u.username)).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <select className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent" value={assignDept} onChange={(e) => setAssignDept(e.target.value)}>
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
                <button className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700" onClick={assign} disabled={loading || !assignUser || !assignDept}>Assign</button>
              </div>

              <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 px-2 text-left">User</th>
                      <th className="py-2 px-2 text-left">Departments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const all = usernames.length ? usernames : users.map((u) => u.username);
                      const total = all.length;
                      const start = (usersPage - 1) * usersLimit;
                      const pageItems = all.slice(start, start + usersLimit);
                      return pageItems.map((uname) => {
                      const deptIds = usernameToDeptIds.get(uname) || [];
                      const userDepartments = departments.filter((d) => deptIds.includes(d._id));
                      return (
                        <tr key={uname} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-2">{uname}</td>
                          <td className="py-2 px-2">
                            <div className="flex flex-wrap gap-2">
                              {userDepartments.length ? (
                                userDepartments.map((d) => (
                                  <span key={d._id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700">
                                    <span className="w-2 h-2 rounded" style={{ background: d.color || '#9ca3af' }} />
                                    {d.name}
                                    <button className="ml-1 text-[10px] px-1 rounded border border-gray-300 dark:border-gray-700" onClick={() => unassign(uname, d._id)}>x</button>
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-500">No departments</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                      });
                    })()}
                  </tbody>
                </table>
                <div className="flex items-center justify-between p-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800">
                  <div>
                    Page {usersPage}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
                      onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                      disabled={usersPage <= 1}
                    >
                      Prev
                    </button>
                    <button
                      className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
                      onClick={() => {
                        const all = usernames.length ? usernames : users.map((u) => u.username);
                        const total = all.length;
                        const maxPage = Math.max(1, Math.ceil(total / usersLimit));
                        setUsersPage((p) => Math.min(maxPage, p + 1));
                      }}
                      disabled={(() => {
                        const all = usernames.length ? usernames : users.map((u) => u.username);
                        const total = all.length;
                        return usersPage * usersLimit >= total;
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
      </div>
    </div>
  );
}


