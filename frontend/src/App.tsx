import React, { useEffect, useState } from 'react';
import { Header } from 'src/components/Header';
import { KpiCards } from 'src/components/KpiCards';
import { ActivityLog } from 'src/components/ActivityLog';
import { Screenshots } from 'src/components/Screenshots';
import { Login } from 'src/components/Login';
import { DomainActivityChart } from 'src/components/DomainActivityChart';
import { UsersOverview } from 'src/components/UsersOverview';
import { ActivityFilters, ActivityFilterState } from 'src/components/ActivityFilters';
import { AdminUsers } from 'src/components/AdminUsers';
import { DepartmentsModal } from 'src/components/DepartmentsModal';
import { authStatus, fetchActivity, fetchScreenshots, fetchSummary, fetchTopDomains, fetchUsersAnalytics, listDistinctUsers, login as apiLogin, logout as apiLogout } from 'src/api/client';
import { ActivityItem, Paginated, SummaryResponse, ScreenshotItem, AuthUser, TopDomainItem, UserAggregateItem } from 'src/types';

function App(): JSX.Element {
  const [dark, setDark] = useState<boolean>(true);
  const [user, setUser] = useState<AuthUser | null>(null);
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
  const [filters, setFilters] = useState<ActivityFilterState>({ timeRange: 'all' });
  const [showDepartments, setShowDepartments] = useState(false);
  const [usersOptions, setUsersOptions] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const s = await authStatus();
      if (s.authenticated && s.user) setUser(s.user);
    })();
  }, []);

  const loadSummary = async () => {
    setSummaryError(undefined);
    setSummaryLoading(true);
    try {
      setSummary(await fetchSummary());
    } catch (e: unknown) {
      setSummaryError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadActivity = async () => {
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
        }),
      );
    } catch (e: unknown) {
      setActivityError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setActivityLoading(false);
    }
  };

  const loadScreenshots = async () => {
    setShotsError(undefined);
    setShotsLoading(true);
    try {
      const res = await fetchScreenshots({ page: shotsPage, limit: shotsLimit, user: shotsUser || undefined });
      setShots(res.items);
      setShotsTotal((res as any).total ?? (res as any).count ?? 0);
    } catch (e: unknown) {
      setShotsError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setShotsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadSummary();
    loadActivity();
    loadScreenshots();
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
  }, [user, filters, activityPage, shotsPage, shotsUser]);

  const handleLogin = async (u: string, p: string) => {
    const logged = await apiLogin(u, p);
    setUser(logged);
  };
  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
  };

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
        <Header username={user?.username} role={user?.role} dark={dark} onToggleDark={() => setDark((v) => !v)} onLogout={handleLogout} />

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          <section>
            <KpiCards
              events={summary?.totals?.events || summary?.total?.events || 0}
              users={(summary as any)?.registeredUsers || summary?.totals?.users || summary?.total?.users || 0}
              screenshots={summary?.totals?.screenshots || 0}
              domains={summary?.totals?.domains || summary?.total?.domains || 0}
              loading={summaryLoading}
              error={summaryError}
            />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DomainActivityChart data={topDomains} loading={topDomainsLoading} error={topDomainsError} />
            </div>
            <div>
              <UsersOverview data={usersAgg} loading={usersAggLoading} error={usersAggError} />
            </div>
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
            />
            <div className="mt-4">
              <ActivityLog
                data={activity}
                loading={activityLoading}
                error={activityError}
                onRefresh={loadActivity}
                onPageChange={(p) => setActivityPage(p)}
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
            userFilter={shotsUser}
            onUserFilterChange={(u) => { setShotsPage(1); setShotsUser(u); }}
          />

          {user?.role === 'ADMIN' && <AdminUsers canManage={true} />}
        </main>
        <DepartmentsModal open={showDepartments} onClose={() => setShowDepartments(false)} />
      </div>
    </div>
  );
}

export default App;


