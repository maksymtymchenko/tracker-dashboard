import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { DepartmentAnalytics as DepartmentAnalyticsType, Paginated, ActivityItem, DepartmentUserAnalytics } from 'src/types';
import { fetchActivity, fetchDepartmentUsersAnalytics } from 'src/api/client';
import { ActivityLog } from './ActivityLog';

interface Props {
  data: DepartmentAnalyticsType[];
  loading: boolean;
  error?: string;
  onDepartmentClick?(departmentId: string, departmentName: string): void;
  selectedMetric?: 'events' | 'duration' | 'users';
  onMetricChange?(metric: 'events' | 'duration' | 'users'): void;
  selectedDepartment?: { id: string; name: string } | null;
  filters?: { timeRange?: 'all' | 'today' | 'week' | 'month'; search?: string; domain?: string; type?: string };
  onUserClick?(username: string): void;
}

export function DepartmentAnalytics({
  data,
  loading,
  error,
  onDepartmentClick,
  selectedMetric: externalMetric,
  onMetricChange,
  selectedDepartment,
  filters = {},
  onUserClick,
}: Props): JSX.Element {
  const [internalMetric, setInternalMetric] = useState<'events' | 'duration' | 'users'>('events');
  const viewMode = externalMetric !== undefined ? externalMetric : internalMetric;
  
  const handleMetricChange = (metric: 'events' | 'duration' | 'users') => {
    if (onMetricChange) {
      onMetricChange(metric);
    } else {
      setInternalMetric(metric);
    }
  };
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [departmentActivity, setDepartmentActivity] = useState<Paginated<ActivityItem> | null>(null);
  const [departmentActivityLoading, setDepartmentActivityLoading] = useState(false);
  const [departmentActivityError, setDepartmentActivityError] = useState<string | undefined>();
  const [departmentActivityPage, setDepartmentActivityPage] = useState(1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pieHoverIndex, setPieHoverIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllCards, setShowAllCards] = useState(false);
  const [maxChartItems] = useState(15); // Limit departments shown in charts
  const [cardsPerPage] = useState(12); // Number of cards to show initially
  const [cardViewMode, setCardViewMode] = useState<'cards' | 'list'>('cards');
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [departmentUsers, setDepartmentUsers] = useState<Map<string, DepartmentUserAnalytics[]>>(new Map());
  const [departmentUsersLoading, setDepartmentUsersLoading] = useState<Map<string, boolean>>(new Map());
  const [departmentUsersError, setDepartmentUsersError] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load department activity when department is selected
  useEffect(() => {
    if (!selectedDepartment) {
      setDepartmentActivity(null);
      return;
    }

    const loadDepartmentActivity = async () => {
      setDepartmentActivityError(undefined);
      setDepartmentActivityLoading(true);
      try {
        const activity = await fetchActivity({
          page: departmentActivityPage,
          limit: 20,
          timeRange: filters.timeRange || 'all',
          department: selectedDepartment.name,
          domain: filters.domain || undefined,
          type: filters.type || undefined,
          search: filters.search || undefined,
        });
        setDepartmentActivity(activity);
      } catch (e: unknown) {
        setDepartmentActivityError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setDepartmentActivityLoading(false);
      }
    };

    loadDepartmentActivity();
  }, [selectedDepartment, departmentActivityPage, filters]);

  // Load department users analytics when department is expanded and viewMode is 'users'
  useEffect(() => {
    const loadDepartmentUsers = async (departmentId: string) => {
      // Check if already loading
      if (departmentUsersLoading.get(departmentId)) {
        return;
      }

      // Only load if not already loaded or if viewMode is 'users'
      if (departmentUsers.has(departmentId) && viewMode === 'users') {
        return; // Already loaded
      }

      setDepartmentUsersLoading((prev) => new Map(prev).set(departmentId, true));
      setDepartmentUsersError((prev) => {
        const newMap = new Map(prev);
        newMap.delete(departmentId);
        return newMap;
      });

      try {
        const users = await fetchDepartmentUsersAnalytics(departmentId);
        setDepartmentUsers((prev) => new Map(prev).set(departmentId, users));
      } catch (e: unknown) {
        setDepartmentUsersError((prev) => {
          const newMap = new Map(prev);
          newMap.set(departmentId, e instanceof Error ? e.message : 'Failed to load');
          return newMap;
        });
      } finally {
        setDepartmentUsersLoading((prev) => {
          const newMap = new Map(prev);
          newMap.set(departmentId, false);
          return newMap;
        });
      }
    };

    // Load users for all expanded departments when viewMode is 'users'
    if (viewMode === 'users') {
      expandedDepartments.forEach((deptId) => {
        loadDepartmentUsers(deptId);
      });
    }
  }, [expandedDepartments, viewMode]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} s`;
    const minutes = Math.floor(seconds / 60);
    const remSec = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes}m ${remSec}s`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours}h ${remMin}m`;
  };

  const formatHours = (hours: number): string => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = Math.floor(hours / 24);
    const remHours = Math.round(hours % 24);
    return `${days}d ${remHours}h`;
  };

  const formatDurationFromMs = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
    const minutes = Math.floor(seconds / 60);
    const remSec = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes}m ${remSec}s`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours}h ${remMin}m`;
  };

  const toggleDepartmentExpansion = (departmentId: string) => {
    setExpandedDepartments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(departmentId)) {
        newSet.delete(departmentId);
      } else {
        newSet.add(departmentId);
      }
      return newSet;
    });
  };

  // Filter and sort data based on search and view mode
  const filteredData = useMemo(() => {
    let filtered = [...data];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((dept) => 
        dept.name.toLowerCase().includes(query)
      );
    }
    
    // Sort by current view mode
    filtered.sort((a, b) => {
      if (viewMode === 'events') return b.events - a.events;
      if (viewMode === 'duration') return b.durationHours - a.durationHours;
      return b.userCount - a.userCount;
    });
    
    return filtered;
  }, [data, searchQuery, viewMode]);

  // Prepare chart data (limit to top N for better visualization)
  const chartData = useMemo(() => {
    return filteredData.slice(0, maxChartItems).map((dept) => ({
      name: dept.name,
      events: dept.events,
      duration: dept.durationHours,
      durationMs: dept.duration,
      users: dept.userCount,
      color: dept.color || '#3b82f6',
      uniqueDomains: dept.uniqueDomains,
      averageDuration: dept.averageDuration,
      id: dept.id,
    }));
  }, [filteredData, maxChartItems]);

  // Calculate totals for pie chart (use filtered data)
  const totalEvents = filteredData.reduce((sum, dept) => sum + dept.events, 0);
  const totalDuration = filteredData.reduce((sum, dept) => sum + dept.duration, 0);
  const pieData = useMemo(() => {
    return filteredData.slice(0, maxChartItems).map((dept) => ({
      name: dept.name,
      value: viewMode === 'events' 
        ? dept.events 
        : viewMode === 'duration' 
          ? dept.durationHours 
          : dept.userCount,
      color: dept.color || '#3b82f6',
    })).filter((item) => item.value > 0);
  }, [filteredData, viewMode, maxChartItems]);
  
  // Prepare cards data (with pagination)
  const displayedCards = useMemo(() => {
    if (showAllCards) return filteredData;
    return filteredData.slice(0, cardsPerPage);
  }, [filteredData, showAllCards, cardsPerPage]);
  
  const hasMoreCards = filteredData.length > cardsPerPage;

  const getYAxisLabel = () => {
    if (viewMode === 'events') return 'Events';
    if (viewMode === 'duration') return 'Hours';
    return 'Users';
  };

  const getBarDataKey = () => {
    if (viewMode === 'events') return 'events';
    if (viewMode === 'duration') return 'duration';
    return 'users';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-2 sm:p-3 rounded border border-gray-200 dark:border-gray-700 shadow-lg text-xs sm:text-sm">
        <div className="font-medium mb-1 sm:mb-2">{data.name}</div>
        <div className="space-y-0.5 sm:space-y-1">
          <div>Events: {data.events.toLocaleString()}</div>
          <div>Duration: {formatHours(data.duration)}</div>
          <div>Users: {data.users}</div>
          <div>Domains: {data.uniqueDomains}</div>
          <div>Avg Duration: {formatDuration(data.averageDuration)}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="font-medium text-base sm:text-lg">
            Department Analytics
            {filteredData.length !== data.length && (
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                ({filteredData.length} of {data.length})
              </span>
            )}
          </div>
          {selectedDepartment && (
            <button
              onClick={() => {
                if (onDepartmentClick) {
                  onDepartmentClick('', '');
                }
              }}
              className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              title="Сбросить выбор департамента"
            >
              ✕ Сбросить
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <input
            type="text"
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent min-w-[150px] flex-1 sm:flex-initial"
          />
          <div className="flex gap-2">
          <button
            className={`text-xs sm:text-sm px-3 py-1.5 sm:py-1 rounded-lg border transition-colors touch-manipulation ${
              viewMode === 'events'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
            onClick={() => handleMetricChange('events')}
          >
            Events
          </button>
          <button
            className={`text-xs sm:text-sm px-3 py-1.5 sm:py-1 rounded-lg border transition-colors touch-manipulation ${
              viewMode === 'duration'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
            onClick={() => handleMetricChange('duration')}
          >
            Duration
          </button>
          <button
            className={`text-xs sm:text-sm px-3 py-1.5 sm:py-1 rounded-lg border transition-colors touch-manipulation ${
              viewMode === 'users'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
            onClick={() => handleMetricChange('users')}
          >
            Users
          </button>
          </div>
        </div>
      </div>
      
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      
      {loading ? (
        <div className="h-48 sm:h-64 flex items-center justify-center text-gray-400">Loading…</div>
      ) : filteredData.length === 0 ? (
        <div className="h-48 sm:h-64 flex items-center justify-center text-gray-400">
          {searchQuery ? 'No departments found matching your search' : 'No department data available'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div className="lg:col-span-2 overflow-x-auto">
              <div className="h-48 sm:h-64 min-w-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={chartData} 
                    margin={{ left: 8, right: 8, bottom: 50, top: 8 }}
                    onClick={(data: any) => {
                      if (onDepartmentClick && data && data.activePayload && data.activePayload[0]) {
                        const entry = data.activePayload[0].payload;
                        if (entry && entry.id) {
                          onDepartmentClick(entry.id, entry.name);
                        }
                      }
                    }}
                  >
                    <CartesianGrid stroke="#e5e7eb" strokeOpacity={0.3} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 10 }} 
                      angle={chartData.length > 8 ? -45 : 0} 
                      textAnchor={chartData.length > 8 ? "end" : "middle"} 
                      height={chartData.length > 8 ? 60 : 30}
                      interval={0}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }} 
                      label={{ value: getYAxisLabel(), angle: -90, position: 'insideLeft', style: { fontSize: '10px' } }} 
                    />
                    <Tooltip 
                      content={<CustomTooltip />}
                      wrapperStyle={{ outline: 'none' }}
                      contentStyle={{ 
                        backgroundColor: 'transparent',
                        border: 'none',
                        padding: 0,
                        boxShadow: 'none',
                      }}
                      cursor={{ fill: 'transparent' }}
                    />
                    <Bar 
                      dataKey={getBarDataKey()} 
                      radius={4}
                      onClick={(data: any) => {
                        if (onDepartmentClick && data && data.id) {
                          onDepartmentClick(data.id, data.name);
                        }
                      }}
                      style={{ cursor: onDepartmentClick ? 'pointer' : 'default' }}
                    >
                      {chartData.map((entry, index) => {
                        const isHovered = hoverIndex === index;
                        const isSelected = selectedDepartment?.id === entry.id;
                        const fillColor = entry.color;
                        const opacity = isHovered ? 1 : isSelected ? 1 : 0.88;
                        
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={fillColor}
                            opacity={opacity}
                            onMouseEnter={() => setHoverIndex(index)}
                            onMouseLeave={() => setHoverIndex(null)}
                            onClick={() => {
                              if (onDepartmentClick && entry.id) {
                                onDepartmentClick(entry.id, entry.name);
                              }
                            }}
                            style={{
                              transition: 'opacity 0.2s ease, filter 0.2s ease',
                              cursor: onDepartmentClick ? 'pointer' : 'default',
                              filter: isHovered ? 'brightness(1.08)' : isSelected ? 'brightness(1.15) drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : 'none',
                            }}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="h-48 sm:h-64 min-w-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => {
                        const percentValue = (percent * 100).toFixed(0);
                        return isMobile ? `${percentValue}%` : `${name}: ${percentValue}%`;
                      }}
                      outerRadius={isMobile ? 60 : 80}
                      fill="#8884d8"
                      dataKey="value"
                      onClick={(data: any) => {
                        if (onDepartmentClick && data && data.name) {
                          // Find the department by name to get the ID
                          const dept = filteredData.find((d) => d.name === data.name);
                          if (dept && dept.id) {
                            onDepartmentClick(dept.id, dept.name);
                          }
                        }
                      }}
                    >
                      {pieData.map((entry, index) => {
                        const isHovered = pieHoverIndex === index;
                        // Find the department by name to check if it's selected
                        const dept = filteredData.find((d) => d.name === entry.name);
                        const isSelected = selectedDepartment?.id === dept?.id;
                        const scale = isHovered ? 1.04 : isSelected ? 1.06 : 1;
                        const opacity = isHovered ? 1 : isSelected ? 1 : 0.92;
                        
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color}
                            opacity={opacity}
                            onMouseEnter={() => setPieHoverIndex(index)}
                            onMouseLeave={() => setPieHoverIndex(null)}
                            onClick={() => {
                              if (onDepartmentClick && entry.name) {
                                // Find the department by name to get the ID
                                const dept = filteredData.find((d) => d.name === entry.name);
                                if (dept && dept.id) {
                                  onDepartmentClick(dept.id, dept.name);
                                }
                              }
                            }}
                            style={{
                              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                              transform: `scale(${scale})`,
                              transformOrigin: 'center',
                              cursor: onDepartmentClick ? 'pointer' : 'default',
                              filter: isHovered ? 'brightness(1.12) drop-shadow(0 4px 8px rgba(0,0,0,0.15))' : isSelected ? 'brightness(1.15) drop-shadow(0 0 12px rgba(59, 130, 246, 0.6))' : 'none',
                            }}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }: any) => {
                        if (!active || !payload || !payload[0]) return null;
                        const data = payload[0];
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg text-sm">
                            <div className="font-medium mb-1" style={{ color: data.color }}>
                              {data.name}
                            </div>
                            <div className="text-gray-600 dark:text-gray-300">
                              Value: <span className="font-semibold">{data.value}</span>
                            </div>
                          </div>
                        );
                      }}
                      wrapperStyle={{ outline: 'none' }}
                      contentStyle={{ 
                        backgroundColor: 'transparent',
                        border: 'none',
                        padding: 0,
                        boxShadow: 'none',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Department Stats Cards or Department Activities */}
          <div className="mt-4">
            {selectedDepartment ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-medium text-base sm:text-lg">
                      {selectedDepartment.name} - {viewMode === 'events' ? 'Events' : viewMode === 'duration' ? 'Duration' : 'Users'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {viewMode === 'events' && 'Showing all activities (events) for this department'}
                      {viewMode === 'duration' && 'Showing activities sorted by duration for this department'}
                      {viewMode === 'users' && 'Showing activities sorted by user for this department'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onDepartmentClick) {
                        onDepartmentClick('', '');
                      }
                    }}
                    className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    Back to Departments
                  </button>
                </div>
                <ActivityLog
                  data={departmentActivity}
                  loading={departmentActivityLoading}
                  error={departmentActivityError}
                  onPageChange={(p) => setDepartmentActivityPage(p)}
                  onUserClick={onUserClick}
                  searchQuery={filters.search || ''}
                  defaultSortByDuration={viewMode === 'duration'}
                  defaultSortByUser={viewMode === 'users'}
                />
              </div>
            ) : (
              <>
                {/* View Mode Toggle */}
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Departments ({displayedCards.length})
                  </div>
              <div className="flex rounded border border-gray-300 dark:border-gray-700 overflow-hidden">
                <button
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    cardViewMode === 'cards'
                      ? 'bg-blue-600 text-white'
                      : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setCardViewMode('cards')}
                  title="Cards view"
                >
                  ⊞ Cards
                </button>
                <button
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    cardViewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setCardViewMode('list')}
                  title="List view"
                >
                  ☰ List
                </button>
              </div>
            </div>

            {/* Cards View */}
            {cardViewMode === 'cards' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedCards.map((dept) => {
                  const deptColor = dept.color || '#3b82f6';
                  const isExpanded = expandedDepartments.has(dept.id);
                  const isSelected = selectedDepartment?.id === dept.id;
                  const usersData = departmentUsers.get(dept.id);
                  const usersLoading = departmentUsersLoading.get(dept.id) || false;
                  const usersError = departmentUsersError.get(dept.id);

                  return (
                    <div key={dept.id} className="space-y-2">
                      <div
                        className={`p-2.5 sm:p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                            : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50'
                        }`}
                        style={{ borderLeftColor: deptColor, borderLeftWidth: '4px' }}
                        onClick={() => {
                          toggleDepartmentExpansion(dept.id);
                          if (onDepartmentClick) {
                            onDepartmentClick(dept.id, dept.name);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="font-medium text-sm" style={{ color: deptColor }}>
                            {dept.name}
                          </div>
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-gray-500 dark:text-gray-400 text-xs">Events</div>
                            <div className="font-semibold text-sm">{dept.events.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400 text-xs">Duration</div>
                            <div className="font-semibold text-sm">{formatHours(dept.durationHours)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400 text-xs">Users</div>
                            <div className="font-semibold text-sm">{dept.userCount}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400 text-xs">Domains</div>
                            <div className="font-semibold text-sm">{dept.uniqueDomains}</div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
                          {viewMode === 'users' ? (
                            <div>
                              <div className="text-sm font-medium mb-3">Пользователи департамента</div>
                              {usersLoading ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
                              ) : usersError ? (
                                <div className="text-sm text-red-600 dark:text-red-400">{usersError}</div>
                              ) : usersData && usersData.length > 0 ? (
                                <div className="space-y-3">
                                  {usersData.map((user) => (
                                    <div
                                      key={user.username}
                                      className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                                    >
                                      <div className="flex items-start justify-between mb-2">
                                        <div>
                                          <div className="font-medium text-sm">
                                            {user.displayName || user.username}
                                          </div>
                                          {user.displayName && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                              {user.username}
                                            </div>
                                          )}
                                        </div>
                                        {onUserClick && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onUserClick(user.username);
                                            }}
                                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                          >
                                            Скриншоты
                                          </button>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-3 text-xs mt-2">
                                        <div>
                                          <div className="text-gray-500 dark:text-gray-400">Время активности</div>
                                          <div className="font-semibold text-sm">
                                            {formatDurationFromMs(user.duration)}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500 dark:text-gray-400">Сайты</div>
                                          <div className="font-semibold text-sm">{user.domains}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500 dark:text-gray-400">События</div>
                                          <div className="font-semibold text-sm">{user.events.toLocaleString()}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500 dark:text-gray-400">Скриншоты</div>
                                          <div className="font-semibold text-sm">{user.screenshots}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500 dark:text-gray-400">Нет данных о пользователях</div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm font-medium mb-3">
                                {viewMode === 'events' ? 'События департамента' : 'Активность по длительности'}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                {viewMode === 'events'
                                  ? 'Показываются все действия (события) по этому департаменту: кто на какие сайты заходил, кто какие приложения держал активными'
                                  : 'Показывается активность, отсортированная по длительности'}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onDepartmentClick) {
                                    onDepartmentClick(dept.id, dept.name);
                                  }
                                }}
                                className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                Показать детали
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* List View */}
            {cardViewMode === 'list' && (
              <div className="space-y-2">
                {displayedCards.map((dept) => {
                  const deptColor = dept.color || '#3b82f6';
                  const isExpanded = expandedDepartments.has(dept.id);
                  const isSelected = selectedDepartment?.id === dept.id;
                  const usersData = departmentUsers.get(dept.id);
                  const usersLoading = departmentUsersLoading.get(dept.id) || false;
                  const usersError = departmentUsersError.get(dept.id);

                  return (
                    <div key={dept.id}>
                      <div
                        className={`flex items-center gap-4 p-2.5 sm:p-3 rounded-lg border transition-colors group cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                            : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                        }`}
                        style={{ borderLeftColor: deptColor, borderLeftWidth: '4px' }}
                        onClick={() => {
                          toggleDepartmentExpansion(dept.id);
                          if (onDepartmentClick) {
                            onDepartmentClick(dept.id, dept.name);
                          }
                        }}
                      >
                        <div className="flex-shrink-0">
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm mb-1" style={{ color: deptColor }}>
                            {dept.name}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <div className="text-gray-500 dark:text-gray-400 text-xs">Events</div>
                              <div className="font-semibold text-sm">{dept.events.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 dark:text-gray-400 text-xs">Duration</div>
                              <div className="font-semibold text-sm">{formatHours(dept.durationHours)}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 dark:text-gray-400 text-xs">Users</div>
                              <div className="font-semibold text-sm">{dept.userCount}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 dark:text-gray-400 text-xs">Domains</div>
                              <div className="font-semibold text-sm">{dept.uniqueDomains}</div>
                            </div>
                          </div>
                          {dept.averageDuration > 0 && (
                            <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                              Avg Duration: {formatDuration(dept.averageDuration)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="mt-2 ml-7 p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
                          {viewMode === 'users' ? (
                            <div>
                              <div className="text-sm font-medium mb-3">Пользователи департамента</div>
                              {usersLoading ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
                              ) : usersError ? (
                                <div className="text-sm text-red-600 dark:text-red-400">{usersError}</div>
                              ) : usersData && usersData.length > 0 ? (
                                <div className="space-y-3">
                                  {usersData.map((user) => (
                                    <div
                                      key={user.username}
                                      className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                                    >
                                      <div className="flex items-start justify-between mb-2">
                                        <div>
                                          <div className="font-medium text-sm">
                                            {user.displayName || user.username}
                                          </div>
                                          {user.displayName && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                              {user.username}
                                            </div>
                                          )}
                                        </div>
                                        {onUserClick && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onUserClick(user.username);
                                            }}
                                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                          >
                                            Скриншоты
                                          </button>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mt-2">
                                        <div>
                                          <div className="text-gray-500 dark:text-gray-400">Время активности</div>
                                          <div className="font-semibold text-sm">
                                            {formatDurationFromMs(user.duration)}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500 dark:text-gray-400">Сайты</div>
                                          <div className="font-semibold text-sm">{user.domains}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500 dark:text-gray-400">События</div>
                                          <div className="font-semibold text-sm">{user.events.toLocaleString()}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500 dark:text-gray-400">Скриншоты</div>
                                          <div className="font-semibold text-sm">{user.screenshots}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500 dark:text-gray-400">Нет данных о пользователях</div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm font-medium mb-3">
                                {viewMode === 'events' ? 'События департамента' : 'Активность по длительности'}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                {viewMode === 'events'
                                  ? 'Показываются все действия (события) по этому департаменту: кто на какие сайты заходил, кто какие приложения держал активными'
                                  : 'Показывается активность, отсортированная по длительности'}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onDepartmentClick) {
                                    onDepartmentClick(dept.id, dept.name);
                                  }
                                }}
                                className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                Показать детали
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Show More/Less Button */}
            {hasMoreCards && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setShowAllCards(!showAllCards)}
                  className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  {showAllCards 
                    ? `Show Less (${cardsPerPage} of ${filteredData.length})` 
                    : `Show More (${filteredData.length - cardsPerPage} more)`}
                </button>
              </div>
            )}
            
            {/* Chart limit notice */}
            {filteredData.length > maxChartItems && (
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                Showing top {maxChartItems} departments in charts (out of {filteredData.length} total)
              </div>
            )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

