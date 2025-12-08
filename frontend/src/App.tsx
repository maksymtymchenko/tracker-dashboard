import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Header } from 'src/components/Header';
import { KpiCards } from 'src/components/KpiCards';
import { ActivityLog } from 'src/components/ActivityLog';
import { Screenshots } from 'src/components/Screenshots';
import { Login } from 'src/components/Login';
import { DomainActivityChart } from 'src/components/DomainActivityChart';
import { ActivityFilters, ActivityFilterState } from 'src/components/ActivityFilters';
import { AdminUsers } from 'src/components/AdminUsers';
import { DepartmentsModal } from 'src/components/DepartmentsModal';
import { DepartmentAnalytics } from 'src/components/DepartmentAnalytics';
import { UserDetailsModal } from 'src/components/UserDetailsModal';
import { DepartmentUsersModal } from 'src/components/DepartmentUsersModal';
import { authStatus, fetchActivity, fetchScreenshots, fetchSummary, fetchTopDomains, fetchUsersAnalytics, fetchDepartmentsAnalytics, listDistinctUsers, login as apiLogin, logout as apiLogout } from 'src/api/client';
import { ActivityItem, Paginated, SummaryResponse, ScreenshotItem, AuthUser, TopDomainItem, UserAggregateItem, DepartmentAnalytics as DepartmentAnalyticsType } from 'src/types';

function App(): JSX.Element {
  const [dark, setDark] = useState<boolean>(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | undefined>();
  const [activity, setActivity] = useState<Paginated<ActivityItem> | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | undefined>();
  const [activityPage, setActivityPage] = useState(1);
  const [activityLimit] = useState(20);
  const [shots, setShots] = useState<ScreenshotItem[]>([]);
  const [shotsLoading, setShotsLoading] = useState(false);
  const [shotsError, setShotsError] = useState<string | undefined>();
  const [shotsPage, setShotsPage] = useState(1);
  const [shotsLimit] = useState(12);
  const [shotsTotal, setShotsTotal] = useState(0);
  const [shotsUser, setShotsUser] = useState<string>('');
  const [topDomains, setTopDomains] = useState<TopDomainItem[]>([]);
  const [topDomainsLoading, setTopDomainsLoading] = useState(false);
  const [topDomainsError, setTopDomainsError] = useState<string | undefined>();
  const [usersAgg, setUsersAgg] = useState<UserAggregateItem[]>([]);
  const [usersAggLoading, setUsersAggLoading] = useState(false);
  const [usersAggError, setUsersAggError] = useState<string | undefined>();
  const [deptAnalytics, setDeptAnalytics] = useState<DepartmentAnalyticsType[]>([]);
  const [deptAnalyticsLoading, setDeptAnalyticsLoading] = useState(false);
  const [deptAnalyticsError, setDeptAnalyticsError] = useState<string | undefined>();
  const [filters, setFilters] = useState<ActivityFilterState>({ timeRange: 'all' });
  const [showDepartments, setShowDepartments] = useState(false);
  const [usersOptions, setUsersOptions] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<{ id: string; name: string } | null>(null);

  const displayNames = useMemo(() => {
    const map: Record<string, string> = {};
    usersAgg.forEach((u) => {
      if (u.displayName) {
        map[u.username] = u.displayName;
      }
    });
    return map;
  }, [usersAgg]);

  useEffect(() => {
    (async () => {
      try {
        const s = await authStatus();
        if (s.authenticated && s.user) setUser(s.user);
      } catch (error) {
        // If auth check fails, user is not authenticated
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    })();
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryError(undefined);
    setSummaryLoading(true);
    try {
      setSummary(await fetchSummary());
    } catch (e: unknown) {
      setSummaryError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setActivityError(undefined);
    setActivityLoading(true);
    try {
      setActivity(
        await fetchActivity({
          page: activityPage,
          limit: activityLimit,
          timeRange: (filters.timeRange as any) || 'all',
          user: filters.user || undefined,
          department: filters.department || undefined,
          domain: filters.domain || undefined,
          type: filters.type || undefined,
          search: filters.search || undefined,
        }),
      );
    } catch (e: unknown) {
      setActivityError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setActivityLoading(false);
    }
  }, [activityPage, activityLimit, filters]);

  const loadScreenshots = useCallback(async () => {
    setShotsError(undefined);
    setShotsLoading(true);
    try {
      // Use filter user if set, otherwise fall back to shotsUser (for backward compatibility)
      const userFilter = filters.user || shotsUser || undefined;
      const res = await fetchScreenshots({
        page: shotsPage,
        limit: shotsLimit,
        user: userFilter,
        department: filters.department || undefined,
        domain: filters.domain || undefined,
        timeRange: (filters.timeRange as any) || 'all',
        search: filters.search || undefined,
      });
      setShots(res.items);
      setShotsTotal((res as any).total ?? (res as any).count ?? 0);
    } catch (e: unknown) {
      setShotsError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setShotsLoading(false);
    }
  }, [shotsPage, shotsLimit, shotsUser, filters]);

  // Reset activity page to 1 when filters change
  useEffect(() => {
    if (user) {
      setActivityPage(1);
    }
  }, [user, filters.search, filters.user, filters.department, filters.domain, filters.timeRange, filters.type]);

  // Reset screenshots page to 1 when filters change
  useEffect(() => {
    if (user) {
      setShotsPage(1);
    }
  }, [user, filters.search, filters.user, filters.department, filters.domain, filters.timeRange]);

  // Load initial data when user logs in
  useEffect(() => {
    if (!user) return;
    loadSummary();
    (async () => {
      try {
        setUsersOptions(await listDistinctUsers());
      } catch {
        setUsersOptions([]);
      }
    })();
    (async () => {
      setTopDomainsError(undefined);
      setTopDomainsLoading(true);
      try {
        setTopDomains(await fetchTopDomains(12));
      } catch (e: unknown) {
        setTopDomainsError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setTopDomainsLoading(false);
      }
    })();
    (async () => {
      setUsersAggError(undefined);
      setUsersAggLoading(true);
      try {
        setUsersAgg(await fetchUsersAnalytics());
      } catch (e: unknown) {
        setUsersAggError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setUsersAggLoading(false);
      }
    })();
    (async () => {
      setDeptAnalyticsError(undefined);
      setDeptAnalyticsLoading(true);
      try {
        const depts = await fetchDepartmentsAnalytics();
        // Prioritize Analytics department - move it to the top
        const sorted = [...depts].sort((a, b) => {
          const aIsAnalytics = a.name.toLowerCase() === 'analytics';
          const bIsAnalytics = b.name.toLowerCase() === 'analytics';
          if (aIsAnalytics && !bIsAnalytics) return -1;
          if (!aIsAnalytics && bIsAnalytics) return 1;
          return b.events - a.events; // Sort by events descending
        });
        setDeptAnalytics(sorted);
      } catch (e: unknown) {
        setDeptAnalyticsError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setDeptAnalyticsLoading(false);
      }
    })();
  }, [user, loadSummary]);

  // Load activity when filters or page changes
  useEffect(() => {
    if (!user) return;
    loadActivity();
  }, [user, loadActivity]);

  // Load screenshots when page or user filter changes
  useEffect(() => {
    if (!user) return;
    loadScreenshots();
  }, [user, loadScreenshots]);

  const handleLogin = async (u: string, p: string) => {
    const logged = await apiLogin(u, p);
    setUser(logged);
  };
  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
  };

  // Show loading state while checking authentication
  if (authChecking) {
    return (
      <div className={dark ? 'dark' : ''}>
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  // Show login form only after confirming user is not authenticated
  if (!user) {
    return (
      <div className={dark ? 'dark' : ''}>
        <Login onSubmit={handleLogin} />
      </div>
    );
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <Header username={user?.username} role={user?.role === 'ADMIN' || user?.role === 'admin' ? 'admin' : 'user'} dark={dark} onToggleDark={() => setDark((v) => !v)} onLogout={handleLogout} />

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          <section>
            <KpiCards
              events={summary?.totals?.events || 0}
              users={(summary as any)?.registeredUsers || summary?.totals?.users || 0}
              screenshots={summary?.totals?.screenshots || 0}
              domains={summary?.totals?.domains || 0}
              loading={summaryLoading}
              error={summaryError}
            />
          </section>

          {deptAnalytics.length > 0 && (
            <section>
              <DepartmentAnalytics 
                data={deptAnalytics} 
                loading={deptAnalyticsLoading} 
                error={deptAnalyticsError}
                onDepartmentClick={(departmentId, departmentName) => {
                  // Show users from this department
                  setSelectedDepartment({ id: departmentId, name: departmentName });
                }}
              />
            </section>
          )}

          <section>
            <DomainActivityChart 
              data={usersAgg} 
              loading={usersAggLoading} 
              error={usersAggError}
              onUserClick={(username) => setSelectedUser(username)}
            />
          </section>

          <section className="p-4 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
            <div className="font-medium mb-3">Activity Log</div>
            <ActivityFilters
              value={filters}
              onChange={(f) => setFilters(f)}
              onExportCSV={() => window.open('/api/export/csv', '_blank')}
              onExportJSON={() => window.open('/api/export/json', '_blank')}
              onRefresh={loadActivity}
              loading={activityLoading}
              onManageDepartments={() => setShowDepartments(true)}
              usersOptions={usersOptions}
              displayNames={displayNames}
            />
            <div className="mt-4">
              <ActivityLog
                data={activity}
                loading={activityLoading}
                error={activityError}
                onPageChange={(p) => setActivityPage(p)}
                onUserClick={(username) => {
                  setSelectedUser(username);
                  // Also filter activity by user
                  setFilters({ ...filters, user: username });
                }}
                searchQuery={filters.search || ''}
              />
            </div>
          </section>

          <Screenshots
            items={shots}
            loading={shotsLoading}
            error={shotsError}
            onRefresh={loadScreenshots}
            page={shotsPage}
            limit={shotsLimit}
            total={shotsTotal}
            onPageChange={(p) => setShotsPage(p)}
            usersOptions={usersOptions}
            userFilter={filters.user || shotsUser}
            onUserFilterChange={(u) => {
              setShotsPage(1);
              setShotsUser(u);
              // Sync with ActivityFilters
              setFilters({ ...filters, user: u || undefined });
            }}
            userRole={user?.role === 'ADMIN' || user?.role === 'admin' ? 'admin' : 'user'}
            searchQuery={filters.search}
            displayNames={displayNames}
          />

          {(user?.role === 'ADMIN' || user?.role === 'admin') && <AdminUsers canManage={true} />}
        </main>
        <DepartmentsModal open={showDepartments} onClose={() => setShowDepartments(false)} />
        <DepartmentUsersModal
          departmentId={selectedDepartment?.id || null}
          departmentName={selectedDepartment?.name || null}
          onClose={() => setSelectedDepartment(null)}
          onUserClick={(username) => setSelectedUser(username)}
        />
        <UserDetailsModal username={selectedUser} onClose={() => setSelectedUser(null)} />
      </div>
    </div>
  );
}

export default App;


