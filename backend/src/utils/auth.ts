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
  
  // Only create default admin in development
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    console.warn('⚠️  WARNING: No admin user found in production. Please create an admin user manually.');
    return;
  }
  
  // In development, create default admin with a warning
  console.warn('⚠️  WARNING: Creating default admin user with password "admin123". Change this immediately!');
  const passwordHash = await hashPassword('admin123');
  await UserModel.create({ username: 'admin', password: passwordHash, role: 'ADMIN' });
}


