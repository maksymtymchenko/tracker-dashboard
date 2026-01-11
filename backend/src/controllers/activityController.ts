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
const ProcessOriginEnum = z.enum(['user', 'system', 'security', 'background']);
const ProcessLaunchTriggerEnum = z.enum(['user_action', 'scheduled_task', 'service', 'unknown']);
const ProcessDetectionSourceEnum = z.enum([
  'active-win',
  'windows-fallback',
  'mac-osa',
  'linux-fallback',
  'unknown',
]);
const ProcessContextSchema = z.object({
  pid: z.number().int().optional(),
  ppid: z.number().int().optional(),
  processName: z.string().optional(),
  parentName: z.string().optional(),
  sessionId: z.number().int().optional(),
  sessionName: z.string().optional(),
  user: z.string().optional(),
  executablePath: z.string().optional(),
  origin: ProcessOriginEnum.optional(),
  launchTrigger: ProcessLaunchTriggerEnum.optional(),
  detectionSource: ProcessDetectionSourceEnum.optional(),
  isSecurityProcess: z.boolean().optional(),
  originReason: z.string().optional(),
});
const ProcessContextNullableSchema = z.union([ProcessContextSchema, z.null()]);

const securityInclusionClause = {
  $or: [
    { 'data.process.origin': { $ne: 'security' } },
    {
      'data.process.origin': 'security',
      'data.process.launchTrigger': 'user_action',
    },
  ],
};
const blockedProcessNames = ['Windows Activity Tracker', 'MsMpEng', 'MsMpEng.exe'];
const blockedProcessRegexes = blockedProcessNames.map(
  (name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
);
const blockedProcessClause = {
  $nor: [
    { 'data.process.processName': { $in: blockedProcessRegexes } },
    { 'data.application': { $in: blockedProcessRegexes } },
    { 'data.title': { $in: blockedProcessRegexes } },
  ],
};

function normalizeLower(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function extractReasonLower(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.reason === 'string') {
    return normalizeLower(d.reason);
  }
  return undefined;
}

function toIsoOrEpoch(value: unknown): string {
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString();
  }
  return date.toISOString();
}

function normalizeDateRange(start?: string, end?: string): { start: Date; end: Date } | null {
  const parseDate = (value?: string): Date | null => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map((v) => Number(v));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m - 1, d);
  };
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate && !endDate) return null;
  const rangeStart = startDate || endDate;
  const rangeEnd = endDate || startDate;
  if (!rangeStart || !rangeEnd) return null;
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(23, 59, 59, 999);
  if (rangeStart.getTime() > rangeEnd.getTime()) {
    return { start: rangeEnd, end: rangeStart };
  }
  return { start: rangeStart, end: rangeEnd };
}

function validateProcessContext(details: unknown): z.ZodIssue[] | null {
  if (!details || typeof details !== 'object') return null;
  const record = details as Record<string, unknown>;
  if (!('process' in record)) return null;
  const result = ProcessContextNullableSchema.safeParse(record.process);
  if (result.success) return null;
  return result.error.issues;
}

function withSecurityFilter(
  filter: Record<string, unknown>,
  includeSecurity: boolean,
  originFilterProvided: boolean,
): Record<string, unknown> {
  if (includeSecurity || originFilterProvided) return filter;
  if (filter.$and) {
    return { ...filter, $and: [...(filter.$and as any[]), securityInclusionClause] };
  }
  return { ...filter, $and: [securityInclusionClause] };
}

function withBlockedProcessFilter(
  filter: Record<string, unknown>,
  _includeSecurity: boolean,
): Record<string, unknown> {
  // Always exclude known noisy system processes regardless of security filter flag.
  const andClauses = filter.$and ? [...(filter.$and as any[]), blockedProcessClause] : [blockedProcessClause];
  return { ...filter, $and: andClauses };
}

function intersectUserFilter(
  current: unknown,
  departmentUsernames: string[],
): { empty: boolean; value?: unknown } {
  if (!current) return { empty: false };
  if (typeof current === 'string') {
    return departmentUsernames.includes(current)
      ? { empty: false, value: current }
      : { empty: true };
  }
  if (typeof current === 'object' && current !== null) {
    const maybeIn = (current as Record<string, unknown>).$in;
    if (Array.isArray(maybeIn)) {
      const allowed = maybeIn.filter((u) => typeof u === 'string' && departmentUsernames.includes(u));
      if (allowed.length === 0) return { empty: true };
      return { empty: false, value: allowed.length === 1 ? allowed[0] : { $in: allowed } };
    }
  }
  return { empty: false, value: current };
}

export async function collectActivity(req: Request, res: Response) {
  const body = z
    .object({ events: z.array(z.union([NewEventShape, OldEventShape])) })
    .safeParse(req.body);
  if (!body.success)
    return res
      .status(400)
      .json({ error: 'invalid payload', issues: body.error.issues });
  const maxEventsRaw = Number(process.env.COLLECTOR_MAX_EVENTS || 1000);
  const maxEvents = Number.isFinite(maxEventsRaw) ? Math.max(1, maxEventsRaw) : 1000;
  if (body.data.events.length > maxEvents) {
    return res.status(413).json({ error: 'too many events in batch' });
  }
  const processIssues = body.data.events.reduce(
    (acc, event, index) => {
      const details = 'time' in event ? event.details : event.data;
      const issues = validateProcessContext(details);
      if (issues) acc.push({ index, issues });
      return acc;
    },
    [] as Array<{ index: number; issues: z.ZodIssue[] }>,
  );
  if (processIssues.length > 0) {
    return res.status(400).json({
      error: 'invalid process context',
      issues: processIssues,
    });
  }
  const docs = await EventModel.insertMany(
    body.data.events.map((e) => {
      if ('time' in e) {
        const dataReasonLower = extractReasonLower(e.details);
        return {
          deviceIdHash: undefined,
          domain: e.domain,
          durationMs: e.duration ?? undefined,
          timestamp: e.time,
          reason: undefined,
          username: e.username,
          type: e.type,
          data: e.details,
          usernameLower: normalizeLower(e.username),
          domainLower: normalizeLower(e.domain),
          typeLower: normalizeLower(e.type),
          reasonLower: undefined,
          dataReasonLower,
        };
      }
      const dataReasonLower = extractReasonLower(e.data);
      return {
        deviceIdHash: e.deviceIdHash,
        domain: e.domain,
        durationMs: e.durationMs,
        timestamp: e.timestamp,
        reason: e.reason,
        username: e.username,
        type: e.type,
        data: e.data,
        usernameLower: normalizeLower(e.username),
        domainLower: normalizeLower(e.domain),
        typeLower: normalizeLower(e.type),
        reasonLower: normalizeLower(e.reason),
        dataReasonLower,
      };
    }),
    { ordered: false },
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
    searchMode: z.enum(['text', 'regex']).default('text'),
    domain: z.string().optional(),
    type: z.string().optional(),
    origin: ProcessOriginEnum.optional(),
    launchTrigger: ProcessLaunchTriggerEnum.optional(),
    sessionId: z.coerce.number().optional(),
    includeSecurity: z.coerce.boolean().optional(),
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(20),
    timeRange: z.enum(['all', 'today', 'week', 'month']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    after: z.string().optional(),
    includeStats: z.coerce.boolean().optional(),
    includeTotal: z.coerce.boolean().optional(),
  });
  const q = querySchema.parse(req.query);
  const isLegacyFormat = (req.query.format as string) === 'legacy';

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
  if (q.origin) filter['data.process.origin'] = q.origin;
  if (q.launchTrigger) filter['data.process.launchTrigger'] = q.launchTrigger;
  if (q.sessionId !== undefined) filter['data.process.sessionId'] = q.sessionId;

  // Text search across common fields (username, domain, type, reason, details.reason, and displayName)
  if (q.search && q.search.trim()) {
    const searchTerm = q.search.trim();
    // Find usernames that match the search in their displayName
    const [displayNameMatches, profileDisplayNameMatches] = await Promise.all([
      UserModel.find(
        { displayName: new RegExp(searchTerm, 'i') },
        { username: 1 },
      ).lean(),
      UserProfileModel.find(
        { displayName: new RegExp(searchTerm, 'i') },
        { username: 1 },
      ).lean(),
    ]);
    const matchingUsernames = [
      ...displayNameMatches.map((u: any) => u.username),
      ...profileDisplayNameMatches.map((p: any) => p.username),
    ].filter(Boolean);

    if (q.searchMode === 'regex') {
      const regex = new RegExp(searchTerm, 'i');
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
    } else {
      const textTerms = [searchTerm, ...matchingUsernames].join(' ');
      filter.$text = { $search: textTerms };
    }
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
          const intersected = intersectUserFilter(filter.username, departmentUsernames);
          if (intersected.empty) {
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
          if (intersected.value !== undefined) {
            filter.username = intersected.value as any;
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
  const dateRange = normalizeDateRange(q.startDate, q.endDate);
  if (dateRange) {
    filter.timestamp = { $gte: dateRange.start, $lte: dateRange.end };
  } else if (q.timeRange && q.timeRange !== 'all') {
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

  let cursorFilter: Record<string, unknown> | undefined;
  if (q.after) {
    const separatorIndex = q.after.lastIndexOf(':');
    if (separatorIndex > 0) {
      const tsPart = q.after.slice(0, separatorIndex);
      const idPart = q.after.slice(separatorIndex + 1);
      const tsNumber = Number(tsPart);
      if (!Number.isNaN(tsNumber) && idPart) {
        const cursorDate = new Date(tsNumber);
        cursorFilter = {
          $or: [
            { timestamp: { $lt: cursorDate } },
            { timestamp: cursorDate, _id: { $lt: idPart } },
          ],
        };
      }
    }
  }
  const isCursorMode = Boolean(cursorFilter);
  const skip = isCursorMode ? 0 : (page - 1) * limit;

  const andFilters: Record<string, unknown>[] = [];
  if (filter.$or) {
    andFilters.push({ $or: filter.$or });
    delete filter.$or;
  }
  if (cursorFilter) {
    andFilters.push(cursorFilter);
  }
  if (andFilters.length > 0) {
    filter.$and = filter.$and ? [...(filter.$and as any[]), ...andFilters] : andFilters;
  }

  const includeStats = q.includeStats ?? !isLegacyFormat;
  const includeTotal = q.includeTotal ?? !isCursorMode;
  const includeSecurity = q.includeSecurity ?? false;
  const statsBaseFilter = withBlockedProcessFilter(
    {
      ...filter,
      ...(filter.$and ? { $and: [...(filter.$and as any[])] } : {}),
    },
    includeSecurity,
  );
  const statsFilter = withSecurityFilter(
    statsBaseFilter,
    includeSecurity,
    Boolean(q.origin),
  );
  const statsPromise = !includeStats
    ? Promise.resolve([])
    : isLegacyFormat
    ? Promise.resolve([])
    : EventModel.aggregate([
        { $match: statsFilter },
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
  const queryLimit = isCursorMode ? limit + 1 : limit;
  const queryFilter = withBlockedProcessFilter(
    {
      ...filter,
      ...(filter.$and ? { $and: [...(filter.$and as any[])] } : {}),
    },
    includeSecurity,
  );
  const [events, total, legacyAgg] = await Promise.all([
    EventModel.find(queryFilter)
      .select({
        timestamp: 1,
        username: 1,
        domain: 1,
        type: 1,
        durationMs: 1,
        reason: 1,
        data: 1,
      })
      .sort({ timestamp: -1, _id: -1 })
      .skip(skip)
      .limit(queryLimit)
      .lean(),
    includeTotal ? EventModel.countDocuments(queryFilter) : Promise.resolve(0),
    statsPromise,
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

  const hasMore = isCursorMode && events.length > limit;
  const slicedEvents = isCursorMode && hasMore ? events.slice(0, limit) : events;
  const nextCursor = isCursorMode && hasMore
    ? `${new Date(slicedEvents[slicedEvents.length - 1].timestamp as any).getTime()}:${slicedEvents[slicedEvents.length - 1]._id}`
    : null;

  // map DB schema to frontend ActivityItem shape
  const items = slicedEvents.map((e: any) => ({
    _id: (e as any)._id,
    time: (e.timestamp as any)?.toISOString?.() || toIsoOrEpoch(e.timestamp as any),
    username: e.username as any,
    displayName: usernameToDisplayName.get(e.username as any),
    department: userToDeptName.get(e.username as any),
    application: extractApplication(e.data),
    domain: e.domain as any,
    type: (e.type as any) || 'window_activity',
    duration: (e.durationMs as any) ?? undefined,
    details: (e.data as any) ?? undefined,
  }));

  if (isLegacyFormat) {
    // compute stats for legacy shape
    const agg = await EventModel.aggregate([
      { $match: statsFilter },
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
    const legacySource = isCursorMode ? slicedEvents : events;
    const legacyEvents = legacySource.map((e: any) => ({
      username: e.username,
      domain: e.domain,
      durationMs: e.durationMs,
      timestamp: e.timestamp,
      reason: e.reason,
      type: e.type,
      data: e.data,
    }));
    return res.json({ count: legacyEvents.length, events: legacyEvents, stats });
  }
  // Also include legacy-compatible fields alongside paginated items
  const compatStats = legacyAgg[0] || {
    totalEvents: 0,
    uniqueUsers: 0,
    uniqueDomains: 0,
    totalDuration: 0,
    averageDuration: 0,
  };
  return res.json({
    items,
    page: isCursorMode ? undefined : page,
    limit,
    total: includeTotal ? total : undefined,
    count: items.length,
    stats: includeStats ? compatStats : undefined,
    hasMore: isCursorMode ? hasMore : undefined,
    nextCursor,
  });
}

export async function analyticsSummary(_req: Request, res: Response) {
  const querySchema = z.object({
    includeSecurity: z.coerce.boolean().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  });
  const q = querySchema.parse(_req.query);
  const includeSecurity = q.includeSecurity ?? false;
  const securityMatch = withSecurityFilter(
    withBlockedProcessFilter({}, includeSecurity),
    includeSecurity,
    false,
  );
  const dateRange = normalizeDateRange(q.startDate, q.endDate);
  const totalMatch = dateRange
    ? withSecurityFilter(
        withBlockedProcessFilter({ timestamp: { $gte: dateRange.start, $lte: dateRange.end } }, includeSecurity),
        includeSecurity,
        false,
      )
    : securityMatch;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(today.getFullYear(), now.getMonth(), 1);

  // Use $facet to run all aggregations in parallel within a single query
  const [result] = await EventModel.aggregate([
    {
      $facet: {
        total: [
          { $match: totalMatch },
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
          {
            $match: withSecurityFilter(
              withBlockedProcessFilter({ timestamp: { $gte: today } }, includeSecurity),
              includeSecurity,
              false,
            ),
          },
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
          {
            $match: withSecurityFilter(
              withBlockedProcessFilter({ timestamp: { $gte: thisWeek } }, includeSecurity),
              includeSecurity,
              false,
            ),
          },
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
          {
            $match: withSecurityFilter(
              withBlockedProcessFilter({ timestamp: { $gte: thisMonth } }, includeSecurity),
              includeSecurity,
              false,
            ),
          },
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
  const screenshotMatch = dateRange
    ? { mtime: { $gte: dateRange.start, $lte: dateRange.end } }
    : {};
  const [registeredUsers, screenshots] = await Promise.all([
    UserModel.countDocuments(),
    ScreenshotModel.countDocuments(screenshotMatch),
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
  const querySchema = z.object({
    limit: z.coerce.number().optional(),
    includeSecurity: z.coerce.boolean().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  });
  const q = querySchema.parse(req.query);
  const limit = q.limit || 10;
  const includeSecurity = q.includeSecurity ?? false;
  const dateRange = normalizeDateRange(q.startDate, q.endDate);
  const baseMatch: Record<string, unknown> = { domain: { $ne: null } };
  if (dateRange) {
    baseMatch.timestamp = { $gte: dateRange.start, $lte: dateRange.end };
  }
  const match = withSecurityFilter(
    withBlockedProcessFilter(baseMatch, includeSecurity),
    includeSecurity,
    false,
  );
  const agg = await EventModel.aggregate([
    { $match: match },
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
  const querySchema = z.object({
    includeSecurity: z.coerce.boolean().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  });
  const q = querySchema.parse(_req.query);
  const includeSecurity = q.includeSecurity ?? false;
  const dateRange = normalizeDateRange(q.startDate, q.endDate);
  const baseMatch: Record<string, unknown> = {};
  if (dateRange) {
    baseMatch.timestamp = { $gte: dateRange.start, $lte: dateRange.end };
  }
  const match = withSecurityFilter(
    withBlockedProcessFilter(baseMatch, includeSecurity),
    includeSecurity,
    false,
  );
  const agg = await EventModel.aggregate([
    { $match: match },
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
