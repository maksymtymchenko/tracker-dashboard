import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { DepartmentAnalytics as DepartmentAnalyticsType } from 'src/types';

interface Props {
  data: DepartmentAnalyticsType[];
  loading: boolean;
  error?: string;
  onDepartmentClick?(departmentId: string, departmentName: string): void;
}

export function DepartmentAnalytics({ data, loading, error, onDepartmentClick }: Props): JSX.Element {
  const [viewMode, setViewMode] = useState<'events' | 'duration' | 'users'>('events');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pieHoverIndex, setPieHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Prepare chart data
  const chartData = data.map((dept) => ({
    name: dept.name,
    events: dept.events,
    duration: dept.durationHours,
    durationMs: dept.duration,
    users: dept.userCount,
    color: dept.color || '#3b82f6',
    uniqueDomains: dept.uniqueDomains,
    averageDuration: dept.averageDuration,
  }));

  // Calculate totals for pie chart
  const totalEvents = data.reduce((sum, dept) => sum + dept.events, 0);
  const totalDuration = data.reduce((sum, dept) => sum + dept.duration, 0);
  const pieData = data.map((dept) => ({
    name: dept.name,
    value: viewMode === 'events' 
      ? dept.events 
      : viewMode === 'duration' 
        ? dept.durationHours 
        : dept.userCount,
    color: dept.color || '#3b82f6',
  })).filter((item) => item.value > 0);

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
        <div className="font-medium text-base sm:text-lg">Department Analytics</div>
        <div className="flex gap-2">
          <button
            className={`text-xs sm:text-sm px-3 py-1.5 sm:py-1 rounded-lg border transition-colors touch-manipulation ${
              viewMode === 'events'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
            onClick={() => setViewMode('events')}
          >
            Events
          </button>
          <button
            className={`text-xs sm:text-sm px-3 py-1.5 sm:py-1 rounded-lg border transition-colors touch-manipulation ${
              viewMode === 'duration'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
            onClick={() => setViewMode('duration')}
          >
            Duration
          </button>
          <button
            className={`text-xs sm:text-sm px-3 py-1.5 sm:py-1 rounded-lg border transition-colors touch-manipulation ${
              viewMode === 'users'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
            onClick={() => setViewMode('users')}
          >
            Users
          </button>
        </div>
      </div>
      
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      
      {loading ? (
        <div className="h-48 sm:h-64 flex items-center justify-center text-gray-400">Loading…</div>
      ) : data.length === 0 ? (
        <div className="h-48 sm:h-64 flex items-center justify-center text-gray-400">No department data available</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div className="lg:col-span-2 overflow-x-auto">
              <div className="h-48 sm:h-64 min-w-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: 8, right: 8, bottom: 50, top: 8 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeOpacity={0.3} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 10 }} 
                      angle={-45} 
                      textAnchor="end" 
                      height={60}
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
                      onClick={(entry: any) => {
                        if (onDepartmentClick && entry) {
                          const deptData = data.find((d) => d.name === entry.name);
                          if (deptData) {
                            onDepartmentClick(deptData.id, deptData.name);
                          }
                        }
                      }}
                      style={{ cursor: onDepartmentClick ? 'pointer' : 'default' }}
                    >
                      {chartData.map((entry, index) => {
                        const isHovered = hoverIndex === index;
                        const fillColor = entry.color;
                        const opacity = isHovered ? 1 : 0.88;
                        
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={fillColor}
                            opacity={opacity}
                            onMouseEnter={() => setHoverIndex(index)}
                            onMouseLeave={() => setHoverIndex(null)}
                            style={{
                              transition: 'opacity 0.2s ease, filter 0.2s ease',
                              cursor: onDepartmentClick ? 'pointer' : 'default',
                              filter: isHovered ? 'brightness(1.08)' : 'none',
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
                    >
                      {pieData.map((entry, index) => {
                        const isHovered = pieHoverIndex === index;
                        const scale = isHovered ? 1.04 : 1;
                        const opacity = isHovered ? 1 : 0.92;
                        
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color}
                            opacity={opacity}
                            onMouseEnter={() => setPieHoverIndex(index)}
                            onMouseLeave={() => setPieHoverIndex(null)}
                            style={{
                              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                              transform: `scale(${scale})`,
                              transformOrigin: 'center',
                              cursor: 'pointer',
                              filter: isHovered ? 'brightness(1.12) drop-shadow(0 4px 8px rgba(0,0,0,0.15))' : 'none',
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

          {/* Department Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {chartData.map((dept, index) => {
              const deptData = data.find((d) => d.name === dept.name);
              return (
                <div
                  key={dept.name}
                  className={`p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 transition-all ${
                    onDepartmentClick ? 'cursor-pointer hover:shadow-md' : ''
                  }`}
                  style={{ borderLeftColor: dept.color, borderLeftWidth: '4px' }}
                  onClick={() => {
                    if (onDepartmentClick && deptData) {
                      onDepartmentClick(deptData.id, deptData.name);
                    }
                  }}
                >
                  <div className="font-medium mb-2 text-sm sm:text-base" style={{ color: dept.color }}>
                    {dept.name}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">Events</div>
                      <div className="font-semibold text-sm sm:text-base">{dept.events.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">Duration</div>
                      <div className="font-semibold text-sm sm:text-base">{formatHours(dept.duration)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">Users</div>
                      <div className="font-semibold text-sm sm:text-base">{dept.users}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">Domains</div>
                      <div className="font-semibold text-sm sm:text-base">{dept.uniqueDomains}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

