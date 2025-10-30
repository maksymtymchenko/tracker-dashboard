import { Request, Response } from 'express';
import { z } from 'zod';
import { EventModel } from '../models/Event';
import { UserModel } from '../models/User.js';
import { ScreenshotModel } from '../models/Screenshot';
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
  if (!body.success) return res.status(400).json({ error: 'invalid payload', issues: body.error.issues });
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
  return res.json({ received: docs.length, saved: docs.length, message: 'Events stored successfully', timestamp: new Date().toISOString() });
}

export async function listActivity(req: Request, res: Response) {
  const querySchema = z.object({
    user: z.string().optional(),
    username: z.string().optional(),
    domain: z.string().optional(),
    type: z.string().optional(),
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(20),
    timeRange: z.enum(['all', 'today', 'week', 'month']).optional(),
  });
  const q = querySchema.parse(req.query);

  const filter: Record<string, unknown> = {};
  if (q.username) filter.username = q.username;
  else if (q.user) filter.username = q.user;
  if (q.domain) filter.domain = q.domain;
  if (q.type) filter.type = q.type;

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
    EventModel.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    EventModel.countDocuments(filter),
  ]);

  // enrich with department names based on latest user-department mapping
  const usernames = Array.from(new Set(events.map((e) => e.username).filter(Boolean))) as string[];
  const userDeps = await UserDepartmentModel.find({ username: { $in: usernames } }).lean();
  const deptIds = Array.from(new Set(userDeps.map((ud) => String(ud.departmentId))));
  const depts = await DepartmentModel.find({ _id: { $in: deptIds } }).lean();
  const deptIdToName = new Map<string, string>();
  depts.forEach((d) => deptIdToName.set(String((d as any)._id), d.name));
  const userToDeptName = new Map<string, string>();
  userDeps.forEach((ud) => {
    const name = deptIdToName.get(String(ud.departmentId));
    if (name && !userToDeptName.has(ud.username)) userToDeptName.set(ud.username, name);
  });

  // map DB schema to frontend ActivityItem shape
  const items = events.map((e) => ({
    _id: (e as any)._id,
    time: (e.timestamp as any)?.toISOString?.() || new Date(e.timestamp as any).toISOString(),
    username: e.username as any,
    department: userToDeptName.get(e.username as any),
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
            $cond: [{ $gt: ['$totalEvents', 0] }, { $divide: ['$totalDuration', '$totalEvents'] }, 0],
          },
        },
      },
    ]);
    const stats = agg[0] || { totalEvents: 0, uniqueUsers: 0, uniqueDomains: 0, totalDuration: 0, averageDuration: 0 };
    const legacyEvents = events.map((e) => ({
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
          $cond: [{ $gt: ['$totalEvents', 0] }, { $divide: ['$totalDuration', '$totalEvents'] }, 0],
        },
      },
    },
  ]);
  const compatStats = legacyAgg[0] || { totalEvents: 0, uniqueUsers: 0, uniqueDomains: 0, totalDuration: 0, averageDuration: 0 };
  return res.json({ items, page, limit, total, count: events.length, stats: compatStats });
}

export async function analyticsSummary(_req: Request, res: Response) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(today.getFullYear(), now.getMonth(), 1);

  const [totalAgg, todayAgg, weekAgg, monthAgg] = await Promise.all([
    EventModel.aggregate([
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
    ]),
    EventModel.aggregate([{ $match: { timestamp: { $gte: today } } }, { $group: { _id: null, events: { $sum: 1 }, duration: { $sum: { $ifNull: ['$durationMs', 0] } } } }, { $project: { _id: 0, events: 1, duration: 1 } }]),
    EventModel.aggregate([{ $match: { timestamp: { $gte: thisWeek } } }, { $group: { _id: null, events: { $sum: 1 }, duration: { $sum: { $ifNull: ['$durationMs', 0] } } } }, { $project: { _id: 0, events: 1, duration: 1 } }]),
    EventModel.aggregate([{ $match: { timestamp: { $gte: thisMonth } } }, { $group: { _id: null, events: { $sum: 1 }, duration: { $sum: { $ifNull: ['$durationMs', 0] } } } }, { $project: { _id: 0, events: 1, duration: 1 } }]),
  ]);
  const total = totalAgg[0] || { events: 0, users: 0, domains: 0, duration: 0 };
  const todayS = todayAgg[0] || { events: 0, duration: 0 };
  const weekS = weekAgg[0] || { events: 0, duration: 0 };
  const monthS = monthAgg[0] || { events: 0, duration: 0 };
  const registeredUsers = await UserModel.countDocuments();
  const screenshots = await ScreenshotModel.estimatedDocumentCount();
  // include legacy-compatible totals with screenshots for UI
  const totals = { events: total.events || 0, users: total.users || 0, domains: total.domains || 0, screenshots };
  return res.json({ total, totals, today: todayS, thisWeek: weekS, thisMonth: monthS, registeredUsers });
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
  const domains = agg.map((d) => ({
    domain: d._id as string,
    totalTime: d.totalTime as number,
    visitCount: d.visitCount as number,
    lastVisit: d.lastVisit as Date,
    totalTimeMinutes: Math.round((d.totalTime as number) / 60000),
    averageTimeMinutes: Math.round(((d.totalTime as number) / Math.max(1, d.visitCount as number)) / 60000),
  }));
  return res.json({ domains, items: domains.map((d) => ({ domain: d.domain, count: d.visitCount })) });
}

export async function analyticsUsers(_req: Request, res: Response) {
  const agg = await EventModel.aggregate([
    { $group: { _id: '$username', events: { $sum: 1 }, domains: { $addToSet: '$domain' }, totalTime: { $sum: { $ifNull: ['$durationMs', 0] } } } },
    { $project: { username: '$_id', _id: 0, events: 1, totalTime: 1, domains: 1, domainsCount: { $size: { $setDifference: ['$domains', [null]] } } } },
    { $sort: { events: -1 } },
  ]);
  const users = agg.map((u) => ({ ...u, avgTime: u.events ? Math.round((u.totalTime as number) / (u.events as number)) : 0 }));
  return res.json({ users, items: users });
}


