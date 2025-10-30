import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User.js';

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function ensureDefaultAdmin(): Promise<void> {
  const existing = await UserModel.findOne({ role: 'ADMIN' }).lean();
  if (existing) return;
  const passwordHash = await hashPassword('admin123');
  await UserModel.create({ username: 'admin', password: passwordHash, role: 'ADMIN' });
}


