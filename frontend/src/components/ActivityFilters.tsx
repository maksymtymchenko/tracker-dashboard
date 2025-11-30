import React, { useEffect, useState } from 'react';
import { listDepartments, listDistinctDomains } from 'src/api/client';
import { Department } from 'src/types';

export interface ActivityFilterState {
  search?: string;
  user?: string;
  department?: string;
  domain?: string;
  timeRange?: 'all' | 'today' | 'week' | 'month';
  type?: 'window_activity' | 'form_interaction' | 'click' | 'keypress' | 'scroll' | 'screenshot' | 'clipboard' | '';
}

interface Props {
  value: ActivityFilterState;
  onChange(next: ActivityFilterState): void;
  onExportCSV(): void;
  onExportJSON(): void;
  onRefresh(): void;
  loading?: boolean;
  onManageDepartments?(): void;
  usersOptions?: string[];
}

export function ActivityFilters({ value, onChange, onExportCSV, onExportJSON, onRefresh, loading, onManageDepartments, usersOptions = [] }: Props): JSX.Element {
  const [draft, setDraft] = useState<ActivityFilterState>(value);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);

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

  const apply = () => onChange(draft);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <input className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" placeholder="Search user/domain/reason" value={draft.search || ''} onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
        {usersOptions.length ? (
          <select className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" value={draft.user || ''} onChange={(e) => setDraft({ ...draft, user: e.target.value })}>
            <option value="">All Users</option>
            {usersOptions.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        ) : (
          <input className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" placeholder="Username" value={draft.user || ''} onChange={(e) => setDraft({ ...draft, user: e.target.value })} />
        )}
        <select className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" value={draft.department || ''} onChange={(e) => setDraft({ ...draft, department: e.target.value })} disabled={loadingDepartments}>
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d.name}>{d.name}</option>
          ))}
        </select>
        <select className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" value={draft.domain || ''} onChange={(e) => setDraft({ ...draft, domain: e.target.value })} disabled={loadingDomains}>
          <option value="">All Domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" value={draft.timeRange || 'all'} onChange={(e) => setDraft({ ...draft, timeRange: e.target.value as any })}>
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <select className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" value={draft.type || ''} onChange={(e) => setDraft({ ...draft, type: e.target.value as any })}>
          <option value="">All Types</option>
          <option value="window_activity">window_activity</option>
          <option value="form_interaction">form_interaction</option>
          <option value="click">click</option>
          <option value="keypress">keypress</option>
          <option value="scroll">scroll</option>
          <option value="screenshot">screenshot</option>
          <option value="clipboard">clipboard</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors" onClick={apply} disabled={loading}>
          Apply
        </button>
        <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <div className="ml-auto flex gap-2">
          {onManageDepartments && (
            <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors" onClick={onManageDepartments}>Manage Departments</button>
          )}
          <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors" onClick={onExportCSV}>Export CSV</button>
          <button className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors" onClick={onExportJSON}>Export JSON</button>
        </div>
      </div>
    </div>
  );
}


