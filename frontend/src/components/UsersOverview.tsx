import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { UserAggregateItem } from 'src/types';

interface Props {
  data: UserAggregateItem[];
  loading: boolean;
  error?: string;
}

export function UsersOverview({ data, loading, error }: Props): JSX.Element {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg text-sm">
        <div className="font-medium mb-1">{data.username}</div>
        <div className="text-gray-600 dark:text-gray-300">
          Events: <span className="font-semibold text-green-600 dark:text-green-400">{data.events}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
      <div className="font-medium mb-2">Users Overview</div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <div className="h-56">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-400">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 12, right: 12, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="username" tick={{ fontSize: 12 }} interval={0} angle={-30} textAnchor="end" height={50} />
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
                cursor={{ stroke: '#e5e7eb', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Line 
                type="monotone" 
                dataKey="events" 
                stroke="#10b981" 
                strokeWidth={2} 
                dot={false}
                activeDot={{ 
                  r: 6, 
                  fill: '#10b981',
                  stroke: '#fff',
                  strokeWidth: 2,
                  style: {
                    transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    filter: 'drop-shadow(0 4px 6px rgba(16, 185, 129, 0.3))',
                  }
                }}
                style={{
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}


