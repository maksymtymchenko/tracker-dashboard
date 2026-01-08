export interface AuthUser {
  username: string;
  role: 'admin' | 'user' | 'ADMIN' | 'VIEWER';
  /** Optional human-friendly display name for the employee */
  displayName?: string;
}

export type ProcessOrigin = 'user' | 'system' | 'security' | 'background';
export type ProcessLaunchTrigger = 'user_action' | 'scheduled_task' | 'service' | 'unknown';
export type ProcessDetectionSource =
  | 'active-win'
  | 'windows-fallback'
  | 'mac-osa'
  | 'linux-fallback'
  | 'unknown';

export interface ProcessContext {
  pid?: number;
  ppid?: number;
  processName?: string;
  parentName?: string;
  sessionId?: number;
  sessionName?: string;
  user?: string;
  executablePath?: string;
  origin?: ProcessOrigin;
  launchTrigger?: ProcessLaunchTrigger;
  detectionSource?: ProcessDetectionSource;
  isSecurityProcess?: boolean;
  originReason?: string;
}

export interface ActivityItem {
  _id?: string;
  time: string;
  username: string;
  /** Optional human-friendly display name for the employee */
  displayName?: string;
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
  url?: string;
  username: string;
  domain?: string;
  deviceId?: string;
  createdAt?: string;
  mtime?: number;
}

export interface TopDomainItem { domain: string; count: number }
export interface UserAggregateItem {
  username: string;
  /** Optional human-friendly display name returned from analytics */
  displayName?: string;
  /** Precomputed label for charts: displayName or username */
  label?: string;
  events: number;
  totalTime: number;
  domainsCount: number;
}

export interface Department { _id: string; name: string; color?: string; description?: string }
export interface UserDepartment { _id: string; username: string; departmentId: string }
export interface BasicUser {
  _id: string;
  username: string;
  role: 'admin' | 'user' | 'ADMIN' | 'VIEWER';
  /** Optional human-friendly display name editable from the admin panel */
  displayName?: string;
}

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

export interface DepartmentUserAnalytics {
  username: string;
  displayName?: string;
  events: number;
  duration: number;
  domains: number;
  websites: number;
  apps: number;
  screenshots: number;
}

