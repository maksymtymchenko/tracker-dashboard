import { Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ScreenshotModel } from '../models/Screenshot';
import { getScreenshotsDir } from '../utils/paths';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CollectSchema = z.object({
  screenshot: z.string(),
  deviceId: z.string().optional(),
  domain: z.string().optional(),
  username: z.string().optional(),
  hostname: z.string().optional(),
  platform: z.string().optional(),
});

export async function collectScreenshot(req: Request, res: Response) {
  const parsed = CollectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });

  const { screenshot, deviceId, domain, username, hostname, platform } = parsed.data;
  const buffer = Buffer.from(screenshot.replace(/^data:image\/png;base64,/, ''), 'base64');
  const dir = getScreenshotsDir();
  await fs.mkdir(dir, { recursive: true });
  const safe = (v?: string) => (v || '').replace(/[^a-zA-Z0-9_.-]/g, '-');
  const parts = [String(Date.now())];
  if (deviceId) parts.push(safe(deviceId));
  if (safe(hostname)) parts.push(safe(hostname));
  if (safe(platform)) parts.push(safe(platform));
  // Fallback to username or domain for backwards compatibility
  if (!hostname && username) parts.push(safe(username));
  if (!hostname && !username && domain) parts.push(safe(domain));
  const filename = `${parts.filter(Boolean).join('_')}.png`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);

  await ScreenshotModel.create({ filename, url: `/screenshots/${filename}`, mtime: new Date(), domain, username: username || 'unknown' });

  return res.json({ saved: filename, ok: true });
}

export async function listScreenshots(req: Request, res: Response) {
  const page = Number(req.query.page || 1);
  const limit = Math.min(100, Number(req.query.limit || 20));
  const user = req.query.user as string | undefined;

  const filter: Record<string, unknown> = {};
  if (user) filter.username = user;

  const [items, total] = await Promise.all([
    ScreenshotModel.find(filter).sort({ mtime: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ScreenshotModel.countDocuments(filter),
  ]);

  const files = items.map((s) => ({ filename: s.filename, url: s.url, mtime: (s.mtime as any)?.valueOf?.() || new Date(s.mtime as any).getTime() }));
  return res.json({ items, total, page, limit, count: total, files });
}

export async function deleteScreenshot(req: Request, res: Response) {
  const { filename } = req.params;
  const shot = await ScreenshotModel.findOneAndDelete({ filename });
  if (!shot) return res.status(404).json({ error: 'not found' });
  const dir = getScreenshotsDir();
  const filePath = path.join(dir, filename);
  await fs.rm(filePath, { force: true });
  return res.json({ success: true, ok: true, message: 'Screenshot deleted successfully', filename });
}

export async function bulkDeleteScreenshots(req: Request, res: Response) {
  const schema = z.object({ filenames: z.array(z.string()), user: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });

  const { filenames } = parsed.data;
  const dir = getScreenshotsDir();
  const result = await ScreenshotModel.deleteMany({ filename: { $in: filenames } });
  await Promise.all(filenames.map((f) => fs.rm(path.join(dir, f), { force: true })));
  return res.json({ ok: true, deleted: result.deletedCount || 0 });
}


