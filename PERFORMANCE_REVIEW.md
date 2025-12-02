# Performance Review & Optimization Recommendations

## Executive Summary

This document outlines performance issues identified in the tracker-dashboard application and provides actionable recommendations to improve both frontend and backend performance.

## Critical Issues

### 🔴 High Priority

1. **Excessive API Calls on Page Load**
   - **Location**: `frontend/src/App.tsx:120-174`
   - **Issue**: Multiple parallel API calls triggered on every filter/page change
   - **Impact**: Slow initial load, unnecessary server load
   - **Fix**: Implement request debouncing, combine related requests, add request cancellation

2. **Missing Database Indexes**
   - **Location**: `backend/src/models/`
   - **Issue**: Missing indexes on frequently queried fields
   - **Impact**: Slow queries, especially with large datasets
   - **Fix**: Add compound indexes for common query patterns

3. **Synchronous Signed URL Generation**
   - **Location**: `backend/src/controllers/screenshotController.ts:85-115`
   - **Issue**: Generating signed URLs sequentially for all screenshots
   - **Impact**: Slow screenshot listing, especially with many items
   - **Fix**: Batch process or use connection pooling

4. **Large Dataset Loading**
   - **Location**: `frontend/src/components/Screenshots.tsx:242-246`
   - **Issue**: "View All" loads 1000 screenshots at once
   - **Impact**: Memory issues, slow rendering, poor UX
   - **Fix**: Implement virtual scrolling or pagination

### 🟡 Medium Priority

5. **Client-Side Filtering on Large Datasets**
   - **Location**: `frontend/src/components/ActivityLog.tsx:137-212`
   - **Issue**: Filtering/sorting happens client-side after fetching all data
   - **Impact**: Unnecessary data transfer, slow filtering
   - **Fix**: Move filtering to backend, use server-side pagination

6. **No Request Caching**
   - **Location**: `frontend/src/api/client.ts`
   - **Issue**: No caching mechanism for frequently accessed data
   - **Impact**: Repeated API calls for same data
   - **Fix**: Implement React Query or SWR for caching

7. **Multiple Separate Aggregation Queries**
   - **Location**: `backend/src/controllers/activityController.ts:247-263`
   - **Issue**: Four separate aggregation queries for summary
   - **Impact**: Multiple database round trips
   - **Fix**: Combine into single aggregation pipeline

8. **Department Analytics Inefficiency**
   - **Location**: `backend/src/controllers/departmentController.ts:103-207`
   - **Issue**: Multiple separate queries and client-side aggregation
   - **Impact**: Slow department analytics loading
   - **Fix**: Optimize with single aggregation pipeline

### 🟢 Low Priority

9. **No Request Debouncing**
   - **Location**: `frontend/src/components/ActivityFilters.tsx`
   - **Issue**: Search queries trigger immediate API calls
   - **Impact**: Excessive API calls during typing
   - **Fix**: Add debouncing (300-500ms)

10. **Missing React Memoization**
    - **Location**: Various components
    - **Issue**: Components re-render unnecessarily
    - **Impact**: Unnecessary re-renders, slower UI
    - **Fix**: Use React.memo, useMemo, useCallback

## Detailed Recommendations

### Frontend Optimizations

#### 1. Implement Request Debouncing & Cancellation

```typescript
// frontend/src/hooks/useDebounce.ts
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// frontend/src/api/client.ts - Add AbortController support
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Add request cancellation
const cancelTokenSource = axios.CancelToken.source();
```

#### 2. Implement React Query for Caching

```typescript
// Install: npm install @tanstack/react-query
// frontend/src/hooks/useActivity.ts
import { useQuery } from '@tanstack/react-query';
import { fetchActivity } from 'src/api/client';

export function useActivity(params: ActivityParams) {
  return useQuery({
    queryKey: ['activity', params],
    queryFn: () => fetchActivity(params),
    staleTime: 30000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

#### 3. Optimize App.tsx useEffect Dependencies

```typescript
// Split useEffect into separate concerns
useEffect(() => {
  if (!user) return;
  loadSummary();
  loadActivity();
  loadScreenshots();
}, [user]); // Only depend on user

useEffect(() => {
  if (!user) return;
  loadActivity();
}, [user, filters, activityPage]); // Separate for filters

useEffect(() => {
  if (!user) return;
  loadScreenshots();
}, [user, shotsPage, shotsUser]); // Separate for screenshots
```

#### 4. Implement Virtual Scrolling for Large Lists

```typescript
// Install: npm install react-window
// For ActivityLog and Screenshots components
import { FixedSizeList } from 'react-window';
```

#### 5. Add Memoization to Expensive Computations

```typescript
// frontend/src/components/ActivityLog.tsx
const processedItems = useMemo(() => {
  // ... existing logic
}, [data?.items, searchQuery, sortField, sortDirection]);
```

### Backend Optimizations

#### 1. Add Missing Database Indexes

```typescript
// backend/src/models/Screenshot.ts
ScreenshotSchema.index({ mtime: -1 });
ScreenshotSchema.index({ username: 1, mtime: -1 }); // ADD THIS
ScreenshotSchema.index({ domain: 1 }); // ADD THIS

// backend/src/models/Event.ts
EventSchema.index({ timestamp: -1 });
EventSchema.index({ username: 1, timestamp: -1 });
EventSchema.index({ domain: 1, timestamp: -1 });
EventSchema.index({ type: 1, timestamp: -1 }); // ADD THIS
EventSchema.index({ username: 1, domain: 1, timestamp: -1 }); // ADD THIS for common queries
```

#### 2. Optimize Screenshot Signed URL Generation

```typescript
// backend/src/controllers/screenshotController.ts
// Use Promise.allSettled for better error handling
const files = await Promise.allSettled(
  items.map(async (s: any) => {
    try {
      const normalizedFilename = extractFilename(s.filename || '');
      const url = await r2Storage.getSignedUrl(normalizedFilename);
      return {
        filename: normalizedFilename,
        url,
        username: s.username,
        domain: s.domain,
        deviceId: s.deviceId,
        mtime: (s.mtime as any)?.valueOf?.() || new Date(s.mtime as any).getTime(),
      };
    } catch (error) {
      console.error(`Failed to get signed URL for ${s.filename}:`, error);
      return {
        filename: s.filename,
        url: s.url || '',
        username: s.username,
        domain: s.domain,
        deviceId: s.deviceId,
        mtime: (s.mtime as any)?.valueOf?.() || new Date(s.mtime as any).getTime(),
      };
    }
  })
);
```

#### 3. Combine Summary Aggregations

```typescript
// backend/src/controllers/activityController.ts
export async function analyticsSummary(_req: Request, res: Response) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Single aggregation with $facet for parallel processing
  const [result] = await EventModel.aggregate([
    {
      $facet: {
        total: [
          {
            $group: {
              _id: null,
              events: { $sum: 1 },
              duration: { $sum: { $ifNull: ['$durationMs', 0] } },
              users: { $addToSet: '$username' },
              domains: { $addToSet: '$domain' },
            },
          },
          { $project: { _id: 0, events: 1, duration: 1, users: { $size: '$users' }, domains: { $size: '$domains' } } },
        ],
        today: [
          { $match: { timestamp: { $gte: today } } },
          { $group: { _id: null, events: { $sum: 1 }, duration: { $sum: { $ifNull: ['$durationMs', 0] } } } },
          { $project: { _id: 0, events: 1, duration: 1 } },
        ],
        week: [
          { $match: { timestamp: { $gte: thisWeek } } },
          { $group: { _id: null, events: { $sum: 1 }, duration: { $sum: { $ifNull: ['$durationMs', 0] } } } },
          { $project: { _id: 0, events: 1, duration: 1 } },
        ],
        month: [
          { $match: { timestamp: { $gte: thisMonth } } },
          { $group: { _id: null, events: { $sum: 1 }, duration: { $sum: { $ifNull: ['$durationMs', 0] } } } },
          { $project: { _id: 0, events: 1, duration: 1 } },
        ],
      },
    },
  ]);

  const total = result.total[0] || { events: 0, users: 0, domains: 0, duration: 0 };
  const todayS = result.today[0] || { events: 0, duration: 0 };
  const weekS = result.week[0] || { events: 0, duration: 0 };
  const monthS = result.month[0] || { events: 0, duration: 0 };

  const [registeredUsers, screenshots] = await Promise.all([
    UserModel.countDocuments(),
    ScreenshotModel.estimatedDocumentCount(),
  ]);

  const totals = { events: total.events || 0, users: total.users || 0, domains: total.domains || 0, screenshots };
  return res.json({ total, totals, today: todayS, thisWeek: weekS, thisMonth: monthS, registeredUsers });
}
```

#### 4. Optimize Department Analytics

```typescript
// backend/src/controllers/departmentController.ts
export async function allDepartmentsAnalytics(req: Request, res: Response) {
  const [departments, userDepartments] = await Promise.all([
    DepartmentModel.find().lean(),
    UserDepartmentModel.find().lean(),
  ]);

  const deptIdToUsers = new Map<string, string[]>();
  userDepartments.forEach((ud) => {
    const deptId = String(ud.departmentId);
    if (!deptIdToUsers.has(deptId)) {
      deptIdToUsers.set(deptId, []);
    }
    deptIdToUsers.get(deptId)!.push(ud.username);
  });

  const allUsernames = Array.from(new Set(userDepartments.map((ud) => ud.username)));

  // Single aggregation with $facet for all user stats
  const [userStatsResult] = await EventModel.aggregate([
    { $match: { username: { $in: allUsernames } } },
    {
      $facet: {
        eventsByUser: [
          {
            $group: {
              _id: '$username',
              events: { $sum: 1 },
              duration: { $sum: { $ifNull: ['$durationMs', 0] } },
              uniqueDomains: { $addToSet: '$domain' },
            },
          },
          {
            $project: {
              username: '$_id',
              _id: 0,
              events: 1,
              duration: 1,
              uniqueDomains: { $size: { $setDifference: ['$uniqueDomains', [null]] } },
            },
          },
        ],
        domainsByUser: [
          { $match: { domain: { $ne: null } } },
          { $group: { _id: { username: '$username', domain: '$domain' } } },
          { $group: { _id: '$_id.username', domains: { $addToSet: '$_id.domain' } } },
          { $project: { username: '$_id', _id: 0, domains: 1 } },
        ],
      },
    },
  ]);

  const userStats = new Map<string, { events: number; duration: number; uniqueDomains: number }>();
  userStatsResult.eventsByUser.forEach((stat: any) => {
    userStats.set(stat.username, {
      events: stat.events || 0,
      duration: stat.duration || 0,
      uniqueDomains: stat.uniqueDomains || 0,
    });
  });

  const userDomains = new Map<string, Set<string>>();
  userStatsResult.domainsByUser.forEach((item: any) => {
    userDomains.set(item.username, new Set(item.domains));
  });

  // Rest of the logic remains the same...
  const deptAnalytics = departments.map((dept) => {
    // ... existing mapping logic
  });

  deptAnalytics.sort((a, b) => b.events - a.events);
  return res.json({ departments: deptAnalytics });
}
```

#### 5. Add Response Caching Middleware

```typescript
// backend/src/middleware/cache.ts
import { Request, Response, NextFunction } from 'express';

const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 30000; // 30 seconds

export function cacheMiddleware(ttl: number = CACHE_TTL) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.method}:${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached && cached.expires > Date.now()) {
      return res.json(cached.data);
    }

    const originalJson = res.json.bind(res);
    res.json = function (data: any) {
      cache.set(key, { data, expires: Date.now() + ttl });
      return originalJson(data);
    };

    next();
  };
}
```

### Database Optimizations

#### 1. Add Compound Indexes

```typescript
// backend/src/models/Event.ts
// Add these indexes:
EventSchema.index({ username: 1, domain: 1, timestamp: -1 });
EventSchema.index({ type: 1, timestamp: -1 });
EventSchema.index({ username: 1, type: 1, timestamp: -1 });

// backend/src/models/Screenshot.ts
ScreenshotSchema.index({ username: 1, mtime: -1 });
ScreenshotSchema.index({ domain: 1, mtime: -1 });
```

#### 2. Consider TTL Indexes for Old Data

```typescript
// Optional: Auto-delete events older than 1 year
EventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });
```

## Implementation Priority

1. **Week 1**: Add missing database indexes (immediate performance gain)
2. **Week 1**: Implement request debouncing in frontend
3. **Week 2**: Optimize backend aggregation queries
4. **Week 2**: Add React Query for caching
5. **Week 3**: Implement virtual scrolling for large lists
6. **Week 3**: Add response caching middleware

## Expected Performance Improvements

- **Initial Load Time**: 40-60% reduction
- **API Response Time**: 30-50% reduction (with indexes)
- **Memory Usage**: 50-70% reduction (with virtual scrolling)
- **Database Query Time**: 60-80% reduction (with proper indexes)
- **User Experience**: Significantly smoother interactions

## Monitoring Recommendations

1. Add performance monitoring (e.g., Sentry, New Relic)
2. Log slow queries (>100ms)
3. Monitor API response times
4. Track frontend render times
5. Set up alerts for performance degradation

## Testing

After implementing optimizations:

1. Load test with realistic data volumes
2. Test with 10k+ events, 1k+ screenshots
3. Monitor database query performance
4. Test concurrent user scenarios
5. Verify no regressions in functionality

