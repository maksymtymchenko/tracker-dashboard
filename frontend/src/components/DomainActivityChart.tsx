import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
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

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg text-sm">
        <div className="font-medium mb-1">{data.username}</div>
        <div className="text-gray-600 dark:text-gray-300">
          Events: <span className="font-semibold text-blue-600 dark:text-blue-400">{data.events}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
      <div className="font-medium mb-2">User Activity</div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <div className="h-56">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-400">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 12, right: 12, bottom: 12 }}>
              <CartesianGrid stroke="#e5e7eb" strokeOpacity={0.3} />
              <XAxis dataKey="username" tick={{ fontSize: 12 }} hide={false} interval={0} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 12 }} />
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
                dataKey="events" 
                fill="#3b82f6" 
                radius={4}
                onClick={handleClick}
                style={{ cursor: onUserClick ? 'pointer' : 'default' }}
              >
                {data.map((entry, index) => {
                  const isHovered = hoverIndex === index;
                  const fillColor = isHovered ? '#2563eb' : '#3b82f6';
                  const opacity = isHovered ? 1 : 0.85;
                  
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={fillColor}
                      opacity={opacity}
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


