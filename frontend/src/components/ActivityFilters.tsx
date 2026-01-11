import React, { useEffect, useState, useRef } from 'react';
import { listDepartments, listDistinctDomains } from 'src/api/client';
import { Department } from 'src/types';

export interface ActivityFilterState {
  search?: string;
  user?: string;
  department?: string;
  domain?: string;
  timeRange?: 'all' | 'today' | 'week' | 'month';
  type?: 'window_activity' | 'form_interaction' | 'click' | 'keypress' | 'scroll' | 'screenshot' | 'clipboard' | '';
  origin?: 'user' | 'system' | 'security' | 'background' | '';
  launchTrigger?: 'user_action' | 'scheduled_task' | 'service' | 'unknown' | '';
  sessionId?: number;
  includeSecurity?: boolean;
}

interface Props {
  value: ActivityFilterState;
  onChange(next: ActivityFilterState): void;
  onExportCSV(): void;
  onExportJSON(): void;
  onRefresh(): void;
  loading?: boolean;
  usersOptions?: string[];
  displayNames?: Record<string, string>;
  hiddenFields?: Partial<Record<'user' | 'department' | 'domain' | 'timeRange' | 'type' | 'origin' | 'launchTrigger' | 'sessionId' | 'includeSecurity', boolean>>;
}

export function ActivityFilters({ value, onChange, onExportCSV, onExportJSON, onRefresh, loading, usersOptions = [], displayNames = {}, hiddenFields }: Props): JSX.Element {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [searchInput, setSearchInput] = useState<string>(value.search || '');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hidden = hiddenFields || {};

  // Sync searchInput with value.search when it changes externally
  useEffect(() => {
    setSearchInput(value.search || '');
  }, [value.search]);

  useEffect(() => {
    const loadDepartments = async () => {
      setLoadingDepartments(true);
      try {
        const deps = await listDepartments();
        setDepartments(deps);
      } catch (e) {
        console.error('Failed to load departments:', e);
      } finally {
        setLoadingDepartments(false);
      }
    };
    loadDepartments();
  }, []);

  useEffect(() => {
    const loadDomains = async () => {
      setLoadingDomains(true);
      try {
        const doms = await listDistinctDomains();
        setDomains(doms);
      } catch (e) {
        console.error('Failed to load domains:', e);
      } finally {
        setLoadingDomains(false);
      }
    };
    loadDomains();
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  const handleFilterChange = (updates: Partial<ActivityFilterState>) => {
    onChange({ ...value, ...updates });
  };

  const handleSearchChange = (search: string) => {
    // Update local state immediately for responsive UI
    setSearchInput(search);

    // Clear existing timeout
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Debounce search to avoid too many API calls while typing
    searchDebounceRef.current = setTimeout(() => {
      handleFilterChange({ search: search || undefined });
    }, 500); // 500ms delay
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <input 
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" 
          placeholder="Search user/domain/reason" 
          value={searchInput} 
          onChange={(e) => handleSearchChange(e.target.value)} 
        />
        {!hidden.user && (usersOptions.length ? (
          <select 
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" 
            value={value.user || ''} 
            onChange={(e) => handleFilterChange({ user: e.target.value || undefined })}>
            <option value="">All Users</option>
            {usersOptions.map((u) => {
              const displayName = displayNames[u];
              const label = displayName && displayName !== u ? `${displayName} (${u})` : u;
              return (
                <option key={u} value={u}>{label}</option>
              );
            })}
          </select>
        ) : (
          <input 
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" 
            placeholder="Username" 
            value={value.user || ''} 
            onChange={(e) => handleFilterChange({ user: e.target.value || undefined })} 
          />
        ))}
        {!hidden.department && (
          <select 
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" 
            value={value.department || ''} 
            onChange={(e) => handleFilterChange({ department: e.target.value || undefined })} 
            disabled={loadingDepartments}>
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d.name}>{d.name}</option>
            ))}
          </select>
        )}
        {!hidden.domain && (
          <select 
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" 
            value={value.domain || ''} 
            onChange={(e) => handleFilterChange({ domain: e.target.value || undefined })} 
            disabled={loadingDomains}>
            <option value="">All Domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
        {!hidden.timeRange && (
          <select 
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" 
            value={value.timeRange || 'all'} 
            onChange={(e) => handleFilterChange({ timeRange: e.target.value as any })}>
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        )}
        {!hidden.type && (
          <select 
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" 
            value={value.type || ''} 
            onChange={(e) => handleFilterChange({ type: e.target.value as any || undefined })}>
            <option value="">All Types</option>
            <option value="window_activity">window_activity</option>
            <option value="form_interaction">form_interaction</option>
            <option value="click">click</option>
            <option value="keypress">keypress</option>
            <option value="scroll">scroll</option>
            <option value="screenshot">screenshot</option>
            <option value="clipboard">clipboard</option>
          </select>
        )}
      </div>
      {(!hidden.origin || !hidden.launchTrigger || !hidden.sessionId || !hidden.includeSecurity) && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {!hidden.origin && (
            <select
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent"
              value={value.origin || ''}
              onChange={(e) => handleFilterChange({ origin: e.target.value as any || undefined })}
            >
              <option value="">All Origins</option>
              <option value="user">user</option>
              <option value="system">system</option>
              <option value="security">security</option>
              <option value="background">background</option>
            </select>
          )}
          {!hidden.launchTrigger && (
            <select
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent"
              value={value.launchTrigger || ''}
              onChange={(e) => handleFilterChange({ launchTrigger: e.target.value as any || undefined })}
            >
              <option value="">All Triggers</option>
              <option value="user_action">user_action</option>
              <option value="scheduled_task">scheduled_task</option>
              <option value="service">service</option>
              <option value="unknown">unknown</option>
            </select>
          )}
          {!hidden.sessionId && (
            <input
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent"
              placeholder="Session ID"
              type="number"
              value={value.sessionId ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  handleFilterChange({ sessionId: undefined });
                  return;
                }
                const next = Number(raw);
                handleFilterChange({ sessionId: Number.isFinite(next) ? next : undefined });
              }}
            />
          )}
          {!hidden.includeSecurity && (
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                className="rounded border-gray-300 dark:border-gray-700"
                checked={Boolean(value.includeSecurity)}
                onChange={(e) => handleFilterChange({ includeSecurity: e.target.checked })}
              />
              Include security events
            </label>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <div className="ml-auto flex gap-2">
          <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors" onClick={onExportCSV}>Export CSV</button>
          <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors" onClick={onExportJSON}>Export JSON</button>
        </div>
      </div>
    </div>
  );
}
