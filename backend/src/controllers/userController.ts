import { Request, Response } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/User.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { hashPassword } from '../utils/auth.js';
import { EventModel } from '../models/Event.js';
import { ScreenshotModel } from '../models/Screenshot.js';
import { validatePasswordStrength, isCommonPassword } from '../utils/passwordValidation.js';
import { logSecurityEvent, SecurityEventType } from '../middleware/securityLogger.js';

export async function listUsers(_req: Request, res: Response) {
  const users = await UserModel.find({}, { password: 0 }).lean();
  return res.json({ items: users, users });
}

export async function createUser(req: Request, res: Response) {
  const schema = z.object({
    username: z.string(),
    password: z.string(),
    role: z.enum(['admin', 'user', 'ADMIN', 'VIEWER']),
    displayName: z.string().min(1).max(200).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
  const { username, password, role, displayName } = parsed.data;
  
  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ 
      error: 'Password does not meet requirements', 
      issues: passwordValidation.errors 
    });
  }
  
  // Check for common passwords
  if (isCommonPassword(password)) {
    return res.status(400).json({ 
      error: 'Password is too common. Please choose a more secure password.' 
    });
  }
  
  const existing = await UserModel.findOne({ username }).lean();
  if (existing) return res.status(400).json({ error: 'username already exists' });
  
  const passwordHash = await hashPassword(password);
  const dbRole = role === 'ADMIN' || role === 'admin' ? 'ADMIN' : 'VIEWER';
  const user = await UserModel.create({ username, password: passwordHash, role: dbRole, displayName });
  
  logSecurityEvent(SecurityEventType.USER_CREATED, {
    createdUsername: username,
    role: dbRole,
    createdBy: req.session.user?.username || 'unknown',
  }, req);
  
  return res.status(201).json({
    ok: true,
    success: true,
    id: user._id.toString(),
    user: {
      username,
      role: dbRole,
      displayName: user.displayName,
    },
  });
}

const updateUserSchema = z
  .object({
    displayName: z.string().min(1).max(200).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No fields to update',
  });

export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined) {
    update.displayName = parsed.data.displayName;
  }

  const user = await UserModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, projection: { password: 0 } },
  ).lean();

  if (!user) {
    return res.status(404).json({ error: 'not found' });
  }

  logSecurityEvent(
    SecurityEventType.PASSWORD_CHANGE,
    {
      // Re-use existing event type for audit trail; consider adding USER_UPDATED if needed
      updatedUserId: id,
      updatedUsername: user.username,
      updatedFields: Object.keys(update),
      updatedBy: req.session.user?.username || 'unknown',
    },
    req,
  );

  return res.json({ ok: true, success: true, user });
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
  const username = user.username;
  await UserModel.findByIdAndDelete(id);
  
  logSecurityEvent(SecurityEventType.USER_DELETED, {
    deletedUsername: username,
    deletedBy: req.session.user?.username || 'unknown',
  }, req);
  
  return res.json({ ok: true, success: true, id });
}

export async function adminDeleteUserData(req: Request, res: Response) {
  const { username } = req.params;
  const [a, s] = await Promise.all([
    EventModel.deleteMany({ username }),
    ScreenshotModel.deleteMany({ username }),
  ]);
  
  logSecurityEvent(SecurityEventType.USER_DATA_DELETED, {
    deletedUsername: username,
    deletedBy: req.session.user?.username || 'unknown',
    activityLogsDeleted: a.deletedCount || 0,
    screenshotsDeleted: s.deletedCount || 0,
  }, req);
  
  return res.json({ ok: true, success: true, message: `Successfully deleted data for user ${username}` , deleted: { activityLogs: a.deletedCount || 0, screenshots: s.deletedCount || 0, screenshotRecords: s.deletedCount || 0 } });
}

const setDisplayNameSchema = z.object({
  username: z.string(),
  displayName: z.string().min(1).max(200),
});

export async function setDisplayNameByUsername(req: Request, res: Response) {
  const parsed = setDisplayNameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
  }

  const { username, displayName } = parsed.data;

  const profile = await UserProfileModel.findOneAndUpdate(
    { username },
    { $set: { username, displayName } },
    { new: true, upsert: true },
  ).lean();

  logSecurityEvent(
    SecurityEventType.PASSWORD_CHANGE,
    {
      // Re-use existing event type for audit trail; consider adding USER_UPDATED/PROFILE_UPDATED if needed
      updatedUsername: username,
      updatedFields: ['displayName'],
      updatedBy: req.session.user?.username || 'unknown',
      source: 'setDisplayNameByUsername',
    },
    req,
  );

  return res.json({ ok: true, success: true, profile });
}


