import { Request, Response } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/User';
import { hashPassword } from '../utils/auth';
import { EventModel } from '../models/Event';
import { ScreenshotModel } from '../models/Screenshot';

export async function listUsers(_req: Request, res: Response) {
  const users = await UserModel.find({}, { password: 0 }).lean();
  return res.json({ items: users, users });
}

export async function createUser(req: Request, res: Response) {
  const schema = z.object({ username: z.string(), password: z.string(), role: z.enum(['admin', 'user', 'ADMIN', 'VIEWER']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
  const { username, password, role } = parsed.data;
  const existing = await UserModel.findOne({ username }).lean();
  if (existing) return res.status(400).json({ error: 'username already exists' });
  const passwordHash = await hashPassword(password);
  const dbRole = role === 'ADMIN' || role === 'admin' ? 'ADMIN' : 'VIEWER';
  const user = await UserModel.create({ username, password: passwordHash, role: dbRole });
  return res.status(201).json({ ok: true, success: true, id: user._id.toString(), user: { username, role: dbRole } });
}

export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;
  const user = await UserModel.findById(id);
  if (!user) return res.status(404).json({ error: 'not found' });
  if (user.role === 'ADMIN') {
    const adminCount = await UserModel.countDocuments({ role: 'ADMIN' });
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin user' });
    }
  }
  await UserModel.findByIdAndDelete(id);
  return res.json({ ok: true, success: true, id });
}

export async function adminDeleteUserData(req: Request, res: Response) {
  const { username } = req.params;
  const [a, s] = await Promise.all([
    EventModel.deleteMany({ username }),
    ScreenshotModel.deleteMany({ username }),
  ]);
  return res.json({ ok: true, success: true, message: `Successfully deleted data for user ${username}` , deleted: { activityLogs: a.deletedCount || 0, screenshots: s.deletedCount || 0, screenshotRecords: s.deletedCount || 0 } });
}


