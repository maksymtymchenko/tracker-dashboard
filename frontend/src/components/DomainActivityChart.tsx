import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ShapeProps } from 'recharts';
import { UserAggregateItem } from 'src/types';

interface Props {
  data: UserAggregateItem[];
  loading: boolean;
  error?: string;
  onUserClick?(username: string): void;
}

export function DomainActivityChart({ data, loading, error, onUserClick }: Props): JSX.Element {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const handleClick = (data: any) => {
    if (data && data.username && onUserClick) {
      onUserClick(data.username);
    }
  };

  const handleMouseEnter = (index: number) => {
    setHoverIndex(index);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const formatDuration = (ms: number): string => {
    if (!Number.isFinite(ms) || ms < 0) return '0h';
    const seconds = ms / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    
    if (hours >= 1) {
      const wholeHours = Math.floor(hours);
      const remainingMinutes = Math.floor(minutes % 60);
      if (remainingMinutes > 0) {
        return `${wholeHours}h ${remainingMinutes}m`;
      }
      return `${wholeHours}h`;
    }
    if (minutes >= 1) {
      return `${Math.floor(minutes)}m`;
    }
    return `${Math.floor(seconds)}s`;
  };

  // Custom bar shape with minimum height for better clickability
  const CustomBar = (props: any) => {
    const { fill, x, y, width, height, payload } = props;
    const minHeight = 12; // Minimum height in pixels for clickability
    const actualHeight = Math.max(height || 0, minHeight);
    const actualY = (height || 0) < minHeight ? (y || 0) - (minHeight - (height || 0)) : (y || 0);
    
    return (
      <rect
        x={x}
        y={actualY}
        width={width}
        height={actualHeight}
        fill={fill}
        rx={4}
        style={{ cursor: onUserClick ? 'pointer' : 'default' }}
        onClick={() => {
          if (payload && payload.username && onUserClick) {
            onUserClick(payload.username);
          }
        }}
      />
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg text-sm">
        <div className="font-medium mb-1">{data.username}</div>
        <div className="text-gray-600 dark:text-gray-300">
          Time: <span className="font-semibold text-blue-600 dark:text-blue-400">{formatDuration(data.totalTime)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
      <div className="font-medium mb-2">User Activity</div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <div className="h-72">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-400">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 12, right: 12, bottom: 12, top: 12 }} barCategoryGap="20%">
              <CartesianGrid stroke="#e5e7eb" strokeOpacity={0.3} />
              <XAxis dataKey="username" tick={{ fontSize: 12 }} hide={false} interval={0} angle={-30} textAnchor="end" height={50} />
              <YAxis 
                tick={{ fontSize: 12 }} 
                tickFormatter={(value) => {
                  const ms = value as number;
                  const hours = ms / (1000 * 60 * 60);
                  if (hours >= 1) {
                    return `${hours.toFixed(1)}h`;
                  }
                  const minutes = ms / (1000 * 60);
                  if (minutes >= 1) {
                    return `${Math.round(minutes)}m`;
                  }
                  return `${Math.round(ms / 1000)}s`;
                }}
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
                dataKey="totalTime" 
                fill="#3b82f6" 
                shape={<CustomBar />}
                onClick={handleClick}
              >
                {data.map((entry, index) => {
                  const isHovered = hoverIndex === index;
                  const fillColor = isHovered ? '#2563eb' : '#3b82f6';
                  
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={fillColor}
                      onMouseEnter={() => handleMouseEnter(index)}
                      onMouseLeave={handleMouseLeave}
                      style={{
                        transition: 'opacity 0.2s ease, fill 0.2s ease',
                        cursor: onUserClick ? 'pointer' : 'default',
                      }}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {onUserClick && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Click on a bar to view user details
        </div>
      )}
    </div>
  );
}


