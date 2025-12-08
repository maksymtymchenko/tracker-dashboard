import { Request, Response } from 'express';
import { z } from 'zod';
import { EventModel } from '../models/Event.js';
import { UserModel } from '../models/User.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { ScreenshotModel } from '../models/Screenshot.js';
import { DepartmentModel, UserDepartmentModel } from '../models/Department.js';

const NewEventShape = z.object({
  time: z.coerce.date(),
  username: z.string(),
  domain: z.string().optional(),
  type: z.string().optional(),
  duration: z.number().optional(),
  details: z.any().optional(),
});
const OldEventShape = z.object({
  deviceIdHash: z.string().optional(),
  domain: z.string().optional(),
  durationMs: z.number().optional(),
  timestamp: z.coerce.date(),
  reason: z.string().optional(),
  username: z.string(),
  type: z.string().optional(),
  data: z.any().optional(),
});

export async function collectActivity(req: Request, res: Response) {
  const body = z
    .object({ events: z.array(z.union([NewEventShape, OldEventShape])) })
    .safeParse(req.body);
  if (!body.success)
    return res
      .status(400)
      .json({ error: 'invalid payload', issues: body.error.issues });
  const docs = await EventModel.insertMany(
    body.data.events.map((e) =>
      'time' in e
        ? {
            deviceIdHash: undefined,
            domain: e.domain,
            durationMs: e.duration ?? undefined,
            timestamp: e.time,
            reason: undefined,
            username: e.username,
            type: e.type,
            data: e.details,
          }
        : {
            deviceIdHash: e.deviceIdHash,
            domain: e.domain,
            durationMs: e.durationMs,
            timestamp: e.timestamp,
            reason: e.reason,
            username: e.username,
            type: e.type,
            data: e.data,
          },
    ),
  );
  return res.json({
    received: docs.length,
    saved: docs.length,
    message: 'Events stored successfully',
    timestamp: new Date().toISOString(),
  });
}

export async function listActivity(req: Request, res: Response) {
  const querySchema = z.object({
    user: z.string().optional(),
    username: z.string().optional(),
    department: z.string().optional(),
    search: z.string().optional(),
    domain: z.string().optional(),
    type: z.string().optional(),
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(20),
    timeRange: z.enum(['all', 'today', 'week', 'month']).optional(),
  });
  const q = querySchema.parse(req.query);

  const filter: Record<string, unknown> = {};

  // Handle user filter - check both username and displayName
  if (q.username || q.user) {
    const userFilter = (q.username || q.user) as string;
    // First try using it as a username directly (most common case from dropdown)
    // Also check if it matches a displayName (for manual input or search)
    const [directUserMatch, displayNameMatch] = await Promise.all([
      UserModel.findOne({ username: userFilter }, { username: 1 }).lean(),
      UserModel.findOne({ displayName: userFilter }, { username: 1 }).lean(),
    ]);

    if (directUserMatch) {
      // It's a username, use it directly
      filter.username = userFilter;
    } else if (displayNameMatch) {
      // It's a displayName, use the corresponding username
      filter.username = displayNameMatch.username;
    } else {
      // Try case-insensitive partial match on displayName
      const displayNameRegex = new RegExp(userFilter, 'i');
      const [displayNameMatches, profileMatches] = await Promise.all([
        UserModel.find(
          { displayName: displayNameRegex },
          { username: 1 },
        ).lean(),
        UserProfileModel.find(
          { displayName: displayNameRegex },
          { username: 1 },
        ).lean(),
      ]);

      const allMatches = [...displayNameMatches, ...profileMatches];
      if (allMatches.length > 0) {
        const usernames = Array.from(
          new Set(allMatches.map((u: any) => u.username).filter(Boolean)),
        );
        if (usernames.length > 0) {
          filter.username =
            usernames.length === 1 ? usernames[0] : { $in: usernames };
        } else {
          // No match found, but still try using it as username (user might not be in UserModel)
          filter.username = userFilter;
        }
      } else {
        // No displayName match found, use it as username directly
        // (user might exist in events but not in UserModel)
        filter.username = userFilter;
      }
    }
  }

  if (q.domain) filter.domain = q.domain;
  if (q.type) filter.type = q.type;

  // Text search across common fields (username, domain, type, reason, details.reason, and displayName)
  if (q.search && q.search.trim()) {
    const regex = new RegExp(q.search.trim(), 'i');
    // Find usernames that match the search in their displayName
    const displayNameMatches = await UserModel.find(
      { displayName: regex },
      { username: 1 },
    ).lean();
    const profileDisplayNameMatches = await UserProfileModel.find(
      { displayName: regex },
      { username: 1 },
    ).lean();
    const matchingUsernames = [
      ...displayNameMatches.map((u: any) => u.username),
      ...profileDisplayNameMatches.map((p: any) => p.username),
    ].filter(Boolean);

    const searchConditions: any[] = [
      { username: regex },
      { domain: regex },
      { type: regex },
      // legacy reason field
      { reason: regex },
      // new events reason nested in data/details
      { 'data.reason': regex },
    ];

    // Add username matches from displayName search
    if (matchingUsernames.length > 0) {
      searchConditions.push({ username: { $in: matchingUsernames } });
    }

    filter.$or = searchConditions;
  }

  // Handle department filtering
  if (q.department) {
    const department = await DepartmentModel.findOne({
      name: q.department,
    }).lean();
    if (department) {
      const userDepts = await UserDepartmentModel.find({
        departmentId: (department as any)._id,
      }).lean();
      const departmentUsernames = Array.from(
        new Set(userDepts.map((ud) => ud.username)),
      ).filter(Boolean) as string[];
      if (departmentUsernames.length > 0) {
        // If username filter is already set, intersect with department users
        if (filter.username) {
          if (!departmentUsernames.includes(filter.username as string)) {
            // User is not in this department, return empty results
            return res.json({
              items: [],
              page: q.page,
              limit: q.limit || 20,
              total: 0,
              count: 0,
              stats: {
                totalEvents: 0,
                uniqueUsers: 0,
                uniqueDomains: 0,
                totalDuration: 0,
                averageDuration: 0,
              },
            });
          }
        } else {
          // Filter by all users in this department
          filter.username = { $in: departmentUsernames };
        }
      } else {
        // No users in this department, return empty results
        return res.json({
          items: [],
          page: q.page,
          limit: q.limit || 20,
          total: 0,
          count: 0,
          stats: {
            totalEvents: 0,
            uniqueUsers: 0,
            uniqueDomains: 0,
            totalDuration: 0,
            averageDuration: 0,
          },
        });
      }
    } else {
      // Department not found, return empty results
      return res.json({
        items: [],
        page: q.page,
        limit: q.limit || 20,
        total: 0,
        count: 0,
        stats: {
          totalEvents: 0,
          uniqueUsers: 0,
          uniqueDomains: 0,
          totalDuration: 0,
          averageDuration: 0,
        },
      });
    }
  }

  const now = new Date();
  if (q.timeRange && q.timeRange !== 'all') {
    const start = new Date();
    if (q.timeRange === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (q.timeRange === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
    } else if (q.timeRange === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    // Use the Event schema's timestamp field
    filter.timestamp = { $gte: start };
  }

  const page = Math.max(1, q.page);
  const limit = Math.min(100, Math.max(1, q.limit));
  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    EventModel.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    EventModel.countDocuments(filter),
  ]);

  // enrich with department names and display names based on latest mappings
  const usernames = Array.from(
    new Set(events.map((e: any) => e.username).filter(Boolean)),
  ) as string[];
  const userDeps = await UserDepartmentModel.find({
    username: { $in: usernames },
  }).lean();
  const deptIds = Array.from(
    new Set(userDeps.map((ud) => String(ud.departmentId))),
  );
  const depts = await DepartmentModel.find({ _id: { $in: deptIds } }).lean();
  const deptIdToName = new Map<string, string>();
  depts.forEach((d) => deptIdToName.set(String((d as any)._id), d.name));
  const userToDeptName = new Map<string, string>();
  userDeps.forEach((ud) => {
    const name = deptIdToName.get(String(ud.departmentId));
    if (name && !userToDeptName.has(ud.username))
      userToDeptName.set(ud.username, name);
  });

  // Resolve display names from User and UserProfile collections
  const [userDocs, profileDocs] = await Promise.all([
    UserModel.find(
      { username: { $in: usernames } },
      { username: 1, displayName: 1 },
    ).lean(),
    UserProfileModel.find(
      { username: { $in: usernames } },
      { username: 1, displayName: 1 },
    ).lean(),
  ]);
  const usernameToDisplayName = new Map<string, string>();
  userDocs.forEach((u: any) => {
    if (u.username && u.displayName) {
      usernameToDisplayName.set(u.username, u.displayName);
    }
  });
  profileDocs.forEach((p: any) => {
    if (p.username && p.displayName && !usernameToDisplayName.has(p.username)) {
      usernameToDisplayName.set(p.username, p.displayName);
    }
  });

  // Helper function to extract application name from data/details
  const extractApplication = (data: unknown): string | undefined => {
    if (!data || typeof data !== 'object') return undefined;
    const d = data as Record<string, unknown>;
    // Try common field names for application
    return (
      (typeof d.application === 'string' ? d.application : undefined) ||
      (typeof d.app === 'string' ? d.app : undefined) ||
      (typeof d.appName === 'string' ? d.appName : undefined) ||
      (typeof d.app_name === 'string' ? d.app_name : undefined) ||
      // Sometimes title contains app name (e.g., "Chrome - Example.com")
      (typeof d.title === 'string' && d.title.includes(' - ')
        ? d.title.split(' - ')[0]
        : undefined)
    );
  };

  // map DB schema to frontend ActivityItem shape
  const items = events.map((e: any) => ({
    _id: (e as any)._id,
    time:
      (e.timestamp as any)?.toISOString?.() ||
      new Date(e.timestamp as any).toISOString(),
    username: e.username as any,
    displayName: usernameToDisplayName.get(e.username as any),
    department: userToDeptName.get(e.username as any),
    application: extractApplication(e.data),
    domain: e.domain as any,
    type: (e.type as any) || 'window_activity',
    duration: (e.durationMs as any) ?? undefined,
    details: (e.data as any) ?? undefined,
  }));

  if ((req.query.format as string) === 'legacy') {
    // compute stats for legacy shape
    const agg = await EventModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          totalDuration: { $sum: { $ifNull: ['$durationMs', 0] } },
          users: { $addToSet: '$username' },
          domains: { $addToSet: '$domain' },
        },
      },
      {
        $project: {
          _id: 0,
          totalEvents: 1,
          totalDuration: 1,
          uniqueUsers: { $size: '$users' },
          uniqueDomains: { $size: '$domains' },
          averageDuration: {
            $cond: [
              { $gt: ['$totalEvents', 0] },
              { $divide: ['$totalDuration', '$totalEvents'] },
              0,
            ],
          },
        },
      },
    ]);
    const stats = agg[0] || {
      totalEvents: 0,
      uniqueUsers: 0,
      uniqueDomains: 0,
      totalDuration: 0,
      averageDuration: 0,
    };
    const legacyEvents = events.map((e: any) => ({
      username: e.username,
      domain: e.domain,
      durationMs: e.durationMs,
      timestamp: e.timestamp,
      reason: e.reason,
      type: e.type,
      data: e.data,
    }));
    return res.json({ count: events.length, events: legacyEvents, stats });
  }
  // Also include legacy-compatible fields alongside paginated items
  const legacyAgg = await EventModel.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        totalDuration: { $sum: { $ifNull: ['$durationMs', 0] } },
        users: { $addToSet: '$username' },
        domains: { $addToSet: '$domain' },
      },
    },
    {
      $project: {
        _id: 0,
        totalEvents: 1,
        totalDuration: 1,
        uniqueUsers: { $size: '$users' },
        uniqueDomains: { $size: '$domains' },
        averageDuration: {
          $cond: [
            { $gt: ['$totalEvents', 0] },
            { $divide: ['$totalDuration', '$totalEvents'] },
            0,
          ],
        },
      },
    },
  ]);
  const compatStats = legacyAgg[0] || {
    totalEvents: 0,
    uniqueUsers: 0,
    uniqueDomains: 0,
    totalDuration: 0,
    averageDuration: 0,
  };
  return res.json({
    items,
    page,
    limit,
    total,
    count: events.length,
    stats: compatStats,
  });
}

export async function analyticsSummary(_req: Request, res: Response) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(today.getFullYear(), now.getMonth(), 1);

  // Use $facet to run all aggregations in parallel within a single query
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
          {
            $project: {
              _id: 0,
              events: 1,
              duration: 1,
              users: { $size: '$users' },
              domains: { $size: '$domains' },
            },
          },
        ],
        today: [
          { $match: { timestamp: { $gte: today } } },
          {
            $group: {
              _id: null,
              events: { $sum: 1 },
              duration: { $sum: { $ifNull: ['$durationMs', 0] } },
            },
          },
          { $project: { _id: 0, events: 1, duration: 1 } },
        ],
        week: [
          { $match: { timestamp: { $gte: thisWeek } } },
          {
            $group: {
              _id: null,
              events: { $sum: 1 },
              duration: { $sum: { $ifNull: ['$durationMs', 0] } },
            },
          },
          { $project: { _id: 0, events: 1, duration: 1 } },
        ],
        month: [
          { $match: { timestamp: { $gte: thisMonth } } },
          {
            $group: {
              _id: null,
              events: { $sum: 1 },
              duration: { $sum: { $ifNull: ['$durationMs', 0] } },
            },
          },
          { $project: { _id: 0, events: 1, duration: 1 } },
        ],
      },
    },
  ]);

  const total = result.total[0] || {
    events: 0,
    users: 0,
    domains: 0,
    duration: 0,
  };
  const todayS = result.today[0] || { events: 0, duration: 0 };
  const weekS = result.week[0] || { events: 0, duration: 0 };
  const monthS = result.month[0] || { events: 0, duration: 0 };

  // Run user and screenshot counts in parallel
  const [registeredUsers, screenshots] = await Promise.all([
    UserModel.countDocuments(),
    ScreenshotModel.estimatedDocumentCount(),
  ]);
  // include legacy-compatible totals with screenshots for UI
  const totals = {
    events: total.events || 0,
    users: total.users || 0,
    domains: total.domains || 0,
    screenshots,
  };
  return res.json({
    total,
    totals,
    today: todayS,
    thisWeek: weekS,
    thisMonth: monthS,
    registeredUsers,
  });
}

export async function analyticsTopDomains(req: Request, res: Response) {
  const limit = Number(req.query.limit || 10);
  const agg = await EventModel.aggregate([
    { $match: { domain: { $ne: null } } },
    {
      $group: {
        _id: '$domain',
        totalTime: { $sum: { $ifNull: ['$durationMs', 0] } },
        visitCount: { $sum: 1 },
        lastVisit: { $max: '$timestamp' },
      },
    },
    { $sort: { totalTime: -1 } },
    { $limit: limit },
  ]);
  const domains = agg.map((d: any) => ({
    domain: d._id as string,
    totalTime: d.totalTime as number,
    visitCount: d.visitCount as number,
    lastVisit: d.lastVisit as Date,
    totalTimeMinutes: Math.round((d.totalTime as number) / 60000),
    averageTimeMinutes: Math.round(
      (d.totalTime as number) / Math.max(1, d.visitCount as number) / 60000,
    ),
  }));
  return res.json({
    domains,
    items: domains.map((d: any) => ({ domain: d.domain, count: d.visitCount })),
  });
}

export async function analyticsUsers(_req: Request, res: Response) {
  const agg = await EventModel.aggregate([
    {
      $group: {
        _id: '$username',
        events: { $sum: 1 },
        domains: { $addToSet: '$domain' },
        totalTime: { $sum: { $ifNull: ['$durationMs', 0] } },
      },
    },
    {
      $project: {
        username: '$_id',
        _id: 0,
        events: 1,
        totalTime: 1,
        domains: 1,
        domainsCount: { $size: { $setDifference: ['$domains', [null]] } },
      },
    },
    { $sort: { events: -1 } },
  ]);
  const usernames = agg.map((u: any) => u.username).filter(Boolean) as string[];
  const [userDocs, profileDocs] = await Promise.all([
    UserModel.find(
      { username: { $in: usernames } },
      { username: 1, displayName: 1 },
    ).lean(),
    UserProfileModel.find(
      { username: { $in: usernames } },
      { username: 1, displayName: 1 },
    ).lean(),
  ]);
  const usernameToDisplayName = new Map<string, string>();
  userDocs.forEach((u: any) => {
    if (u.username && u.displayName) {
      usernameToDisplayName.set(u.username, u.displayName);
    }
  });
  profileDocs.forEach((p: any) => {
    if (p.username && p.displayName && !usernameToDisplayName.has(p.username)) {
      usernameToDisplayName.set(p.username, p.displayName);
    }
  });

  const users = agg.map((u: any) => ({
    ...u,
    displayName: usernameToDisplayName.get(u.username as string),
    avgTime: u.events
      ? Math.round((u.totalTime as number) / (u.events as number))
      : 0,
  }));
  return res.json({ users, items: users });
}
