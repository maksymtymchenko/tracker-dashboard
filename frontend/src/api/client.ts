import axios from 'axios';
import { ActivityItem, Paginated, SummaryResponse, ScreenshotItem, AuthUser, TopDomainItem, UserAggregateItem, Department, UserDepartment, BasicUser } from 'src/types';

export const api = axios.create({ withCredentials: true });

export async function login(username: string, password: string) {
  const { data } = await api.post<{ ok: boolean; user: AuthUser }>('/api/login', { username, password });
  return data.user;
}

export async function logout() {
  await api.post('/api/logout');
}

export async function authStatus() {
  const { data } = await api.get<{ authenticated: boolean; user: AuthUser | null }>('/api/auth/status');
  return data;
}

export async function fetchSummary() {
  const { data } = await api.get<SummaryResponse>('/api/analytics/summary');
  return data;
}

export async function fetchActivity(params: Partial<{ user: string; username: string; domain: string; type: string; page: number; limit: number; timeRange: 'all' | 'today' | 'week' | 'month' }>) {
  const query = { ...params } as any;
  if (params?.user && !params?.username) query.username = params.user; // prefer username param on backend
  const { data } = await api.get<Paginated<ActivityItem>>('/api/activity', { params: query });
  return data;
}

export async function fetchScreenshots(params: Partial<{ page: number; limit: number; user: string }>) {
  const { data } = await api.get<{ items: ScreenshotItem[]; total: number; page: number; limit: number }>('/api/screenshots', { params });
  return data;
}

export async function fetchTopDomains(limit = 10) {
  const { data } = await api.get<{ items: TopDomainItem[] }>('/api/analytics/top-domains', { params: { limit } });
  return data.items;
}

export async function fetchUsersAnalytics() {
  const { data } = await api.get<{ items: UserAggregateItem[] }>('/api/analytics/users');
  return data.items;
}

// Departments API
export async function listDepartments() {
  const { data } = await api.get<{ items: Department[] }>('/api/departments');
  return data.items;
}

export async function createDepartment(payload: Partial<Department>) {
  const { data } = await api.post<{ ok: true; id: string }>('/api/departments', payload);
  return data.id;
}

export async function updateDepartment(id: string, payload: Partial<Department>) {
  await api.put(`/api/departments/${id}`, payload);
}

export async function deleteDepartment(id: string) {
  await api.delete(`/api/departments/${id}`);
}

export async function listUserDepartments() {
  const { data } = await api.get<{ items: UserDepartment[] }>('/api/user-departments');
  return data.items;
}

export async function assignUserDepartment(payload: { username: string; departmentId: string }) {
  await api.post('/api/user-departments', payload);
}

export async function unassignUserDepartment(payload: { username: string; departmentId: string }) {
  await api.delete('/api/user-departments', { data: payload });
}

export async function listUsers() {
  const { data } = await api.get<{ items: BasicUser[] }>('/api/users');
  return data.items;
}

export async function listDistinctUsers() {
  // Prefer distinct from events (does not require admin)
  try {
    const { data } = await api.get<{ users: string[] }>('/api/users/distinct');
    return data.users;
  } catch {
    // Fallback: admin users, then analytics
    try {
      const items = await listUsers();
      return items.map((u) => u.username);
    } catch {
      const agg = await fetchUsersAnalytics();
      return agg.map((u) => u.username);
    }
  }
}

export async function deleteUserById(id: string) {
  const { data } = await api.delete<{ ok: boolean; success: boolean }>(`/api/users/${id}`);
  return data;
}

export async function adminDeleteUserAllData(username: string) {
  const { data } = await api.delete<{ success: boolean; message: string }>(`/api/admin/delete-user/${encodeURIComponent(username)}`);
  return data;
}


