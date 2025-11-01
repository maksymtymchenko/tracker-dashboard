export interface AuthUser {
  username: string;
  role: 'admin' | 'user' | 'ADMIN' | 'VIEWER';
}

export interface ActivityItem {
  _id?: string;
  time: string;
  username: string;
  department?: string;
  application?: string;
  domain?: string;
  url?: string;
  type: 'window_activity' | 'form_interaction' | 'click' | 'keypress' | 'scroll' | 'screenshot' | 'clipboard';
  duration?: number;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface SummaryResponse {
  totals: { events: number; users: number; screenshots: number; domains: number };
  buckets: unknown[];
}

export interface ScreenshotItem {
  filename: string;
  username: string;
  domain?: string;
  deviceId?: string;
  createdAt?: string;
}

export interface TopDomainItem { domain: string; count: number }
export interface UserAggregateItem { username: string; events: number; totalTime: number; domainsCount: number }

export interface Department { _id: string; name: string; color?: string; description?: string }
export interface UserDepartment { _id: string; username: string; departmentId: string }
export interface BasicUser { _id: string; username: string; role: 'admin' | 'user' }

export interface DepartmentAnalytics {
  id: string;
  name: string;
  color?: string;
  description?: string;
  userCount: number;
  events: number;
  duration: number;
  durationHours: number;
  uniqueDomains: number;
  averageDuration: number;
}


