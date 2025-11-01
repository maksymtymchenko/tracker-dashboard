import { Router, Request, Response } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { UserModel } from '../models/User.js';
import { verifyPassword } from '../utils/auth.js';
import {
  collectActivity,
  listActivity,
  analyticsSummary,
  analyticsTopDomains,
  analyticsUsers,
} from '../controllers/activityController.js';
import {
  collectScreenshot,
  listScreenshots,
  deleteScreenshot,
  bulkDeleteScreenshots,
} from '../controllers/screenshotController.js';
import {
  listUsers,
  createUser,
  deleteUser,
  adminDeleteUserData,
} from '../controllers/userController.js';
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listUserDepartments,
  assignUserDepartment,
  unassignUserDepartment,
  usersInDepartment,
  filterUsersByDepartment,
  groupUsersByDepartment,
} from '../controllers/departmentController.js';
import {
  departmentStats,
  allDepartmentsAnalytics,
  searchDepartments,
  exportDepartments,
  importDepartments,
} from '../controllers/departmentController.js';
import { exportCSV, exportJSON } from '../controllers/exportController.js';
import { EventModel } from '../models/Event.js';

const router = Router();

// Authentication
router.post('/api/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };
  if (!username || !password)
    return res.status(400).json({ error: 'username and password required' });
  const user = await UserModel.findOne({ username }).lean();
  if (!user || !user.password)
    return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await verifyPassword(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const role = user.role === 'ADMIN' ? 'admin' : 'user';
  req.session.user = { username: user.username, role };
  await UserModel.updateOne(
    { _id: user._id },
    { $set: { lastLogin: new Date() } },
  );
  return res.json({
    ok: true,
    success: true,
    user: { username: user.username, role: user.role },
    userCompat: req.session.user,
  });
});

router.post('/api/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ ok: true, success: true });
  });
});

router.get('/api/auth/status', (req: Request, res: Response) => {
  const compat = req.session.user || null;
  const user = compat
    ? {
        username: compat.username,
        role: compat.role === 'admin' ? 'ADMIN' : 'VIEWER',
      }
    : undefined;
  res.json({
    authenticated: Boolean(compat),
    user: user ?? null,
    userCompat: compat,
  });
});

// Activity Collection
router.post('/collect-activity', collectActivity);

router.post('/collect-tracking', (req: Request, res: Response) => {
  const { events } = req.body as any;
  if (!events || !Array.isArray(events))
    return res.status(400).json({ error: 'events array required' });
  return res.json({ success: true, count: events.length });
});

router.post('/collect-screenshot', collectScreenshot);

// Analytics and Activity
router.get('/api/activity', requireAuth, listActivity);

router.get('/api/analytics/summary', requireAuth, analyticsSummary);

router.get('/api/analytics/top-domains', requireAuth, analyticsTopDomains);

router.get('/api/analytics/users', requireAuth, analyticsUsers);

// Screenshots
router.get('/api/screenshots', requireAuth, listScreenshots);

router.delete('/api/screenshots/:filename', requireAdmin, deleteScreenshot);

router.delete('/api/screenshots', requireAdmin, bulkDeleteScreenshots);

// Users (admin)
router.get('/api/users', requireAdmin, listUsers);

// Distinct users from events (for filtering in Activity Log)
router.get(
  '/api/users/distinct',
  requireAuth,
  async (_req: Request, res: Response) => {
    const users = (await EventModel.distinct('username'))
      .filter((u: unknown) => !!u)
      .map((u: unknown) => String(u))
      .sort((a: string, b: string) => a.localeCompare(b));
    res.json({ users });
  },
);

// Distinct domains from events (for filtering in Activity Log)
router.get(
  '/api/domains/distinct',
  requireAuth,
  async (_req: Request, res: Response) => {
    const domains = (await EventModel.distinct('domain'))
      .filter((d: unknown) => !!d)
      .map((d: unknown) => String(d))
      .sort((a: string, b: string) => a.localeCompare(b));
    res.json({ domains });
  },
);

router.post('/api/users', requireAdmin, createUser);

router.delete('/api/users/:id', requireAdmin, deleteUser);

router.delete(
  '/api/admin/delete-user/:username',
  requireAdmin,
  adminDeleteUserData,
);

// Departments (admin)
router.get('/api/departments', requireAdmin, listDepartments);

router.post('/api/departments', requireAdmin, createDepartment);

router.put('/api/departments/:id', requireAdmin, updateDepartment);

router.delete('/api/departments/:id', requireAdmin, deleteDepartment);

router.get('/api/user-departments', requireAdmin, listUserDepartments);

router.post('/api/user-departments', requireAdmin, assignUserDepartment);

router.delete('/api/user-departments', requireAdmin, unassignUserDepartment);

router.get('/api/departments/:id/users', requireAdmin, usersInDepartment);

router.post(
  '/api/departments/filter-users',
  requireAdmin,
  filterUsersByDepartment,
);

router.post(
  '/api/departments/group-users',
  requireAdmin,
  groupUsersByDepartment,
);

router.get('/api/departments/:id/stats', requireAdmin, departmentStats);

router.get('/api/departments/analytics', requireAuth, allDepartmentsAnalytics);

router.get('/api/departments/search', requireAdmin, searchDepartments);

router.get('/api/departments/export', requireAdmin, exportDepartments);

router.post('/api/departments/import', requireAdmin, importDepartments);

// Export
router.get('/api/export/csv', requireAdmin, exportCSV);

router.get('/api/export/json', requireAdmin, exportJSON);

// System
router.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, datafiles: 0, screenshots: 0 });
});

export default router;
