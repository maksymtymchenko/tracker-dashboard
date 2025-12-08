import { Request, Response } from 'express';
import { z } from 'zod';
import { ScreenshotModel } from '../models/Screenshot.js';
import { r2Storage } from '../utils/r2Storage.js';
import { DepartmentModel, UserDepartmentModel } from '../models/Department.js';

const CollectSchema = z.object({
  screenshot: z.string(),
  deviceId: z.string().optional(),
  domain: z.string().optional(),
  username: z.string().optional(),
  hostname: z.string().optional(),
  platform: z.string().optional(),
});

/**
 * Extract just the filename from a path (handles Windows/Unix paths)
 */
function extractFilename(pathOrFilename: string): string {
  // Handle Windows paths (C:\... or C:/...)
  const windowsMatch = pathOrFilename.match(/[\/\\]([^\/\\]+\.png)$/i);
  if (windowsMatch) {
    return windowsMatch[1];
  }
  // Handle Unix paths
  const unixMatch = pathOrFilename.match(/\/([^\/]+\.png)$/);
  if (unixMatch) {
    return unixMatch[1];
  }
  // If no path separators, assume it's already just a filename
  return pathOrFilename;
}

export async function collectScreenshot(req: Request, res: Response) {
  const parsed = CollectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });

  const { screenshot, deviceId, domain, username, hostname, platform } = parsed.data;
  const buffer = Buffer.from(screenshot.replace(/^data:image\/png;base64,/, ''), 'base64');
  const safe = (v?: string) => (v || '').replace(/[^a-zA-Z0-9_.-]/g, '-');
  const parts = [String(Date.now())];
  if (deviceId) parts.push(safe(deviceId));
  if (safe(hostname)) parts.push(safe(hostname));
  if (safe(platform)) parts.push(safe(platform));
  // Fallback to username or domain for backwards compatibility
  if (!hostname && username) parts.push(safe(username));
  if (!hostname && !username && domain) parts.push(safe(domain));
  const filename = `${parts.filter(Boolean).join('_')}.png`;

  // Require R2 storage - no filesystem fallback
  if (!r2Storage.isConfigured()) {
    return res.status(500).json({ error: 'R2 storage is not configured. Please set R2 environment variables.' });
  }

  let url: string;
  try {
    url = await r2Storage.uploadFile(filename, buffer, 'image/png');
  } catch (error) {
    console.error('Failed to upload to R2:', error);
    return res.status(500).json({ error: 'Failed to save screenshot to R2 storage' });
  }

  await ScreenshotModel.create({ filename, url, mtime: new Date(), domain, username: username || 'unknown', deviceId });

  return res.json({ saved: filename, ok: true });
}

export async function listScreenshots(req: Request, res: Response) {
  const querySchema = z.object({
    user: z.string().optional(),
    username: z.string().optional(),
    department: z.string().optional(),
    domain: z.string().optional(),
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(20),
    timeRange: z.enum(['all', 'today', 'week', 'month']).optional(),
    search: z.string().optional(),
  });
  const q = querySchema.parse(req.query);

  const page = Math.max(1, q.page);
  const limit = Math.min(100, Math.max(1, q.limit));

  const filter: Record<string, unknown> = {};
  if (q.username) filter.username = q.username;
  else if (q.user) filter.username = q.user;
  if (q.domain) filter.domain = q.domain;

  // Text search across username and domain
  if (q.search && q.search.trim()) {
    const regex = new RegExp(q.search.trim(), 'i');
    filter.$or = [
      { username: regex },
      { domain: regex },
      { filename: regex },
    ];
  }

  // Handle department filtering
  if (q.department) {
    const department = await DepartmentModel.findOne({ name: q.department }).lean();
    if (department) {
      const userDepts = await UserDepartmentModel.find({ departmentId: (department as any)._id }).lean();
      const departmentUsernames = Array.from(new Set(userDepts.map((ud) => ud.username))).filter(Boolean) as string[];
      if (departmentUsernames.length > 0) {
        // If username filter is already set, intersect with department users
        if (filter.username) {
          if (!departmentUsernames.includes(filter.username as string)) {
            // User is not in this department, return empty results
            return res.json({ items: [], total: 0, page, limit, count: 0, files: [] });
          }
        } else {
          // Filter by all users in this department
          filter.username = { $in: departmentUsernames };
        }
      } else {
        // No users in this department, return empty results
        return res.json({ items: [], total: 0, page, limit, count: 0, files: [] });
      }
    } else {
      // Department not found, return empty results
      return res.json({ items: [], total: 0, page, limit, count: 0, files: [] });
    }
  }

  // Handle time range filtering
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
    filter.mtime = { $gte: start };
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    ScreenshotModel.find(filter).sort({ mtime: -1 }).skip(skip).limit(limit).lean(),
    ScreenshotModel.countDocuments(filter),
  ]);

  // Require R2 storage - generate signed URLs for all screenshots
  if (!r2Storage.isConfigured()) {
    return res.status(500).json({ error: 'R2 storage is not configured. Please set R2 environment variables.' });
  }

  // Use Promise.allSettled for better error handling and parallel processing
  const files = await Promise.allSettled(
    items.map(async (s: any) => {
      // Normalize filename - extract just the filename from any path
      const normalizedFilename = extractFilename(s.filename || '');
      
      let url: string;
      try {
        // Generate signed URL for R2 screenshots (valid for 1 hour)
        // Try with normalized filename first
        url = await r2Storage.getSignedUrl(normalizedFilename);
      } catch (error) {
        // If normalized filename fails, try original filename (for backwards compatibility)
        try {
          url = await r2Storage.getSignedUrl(s.filename);
        } catch (error2) {
          console.error(`Failed to get signed URL for ${s.filename} (normalized: ${normalizedFilename}):`, error2);
          // If signed URL generation fails, use stored URL or return error
          url = s.url || '';
        }
      }
      
      return {
        filename: normalizedFilename,
        url,
        username: s.username,
        domain: s.domain,
        deviceId: s.deviceId,
        mtime: (s.mtime as any)?.valueOf?.() || new Date(s.mtime as any).getTime(),
      };
    })
  );

  // Extract successful results, fallback to stored URL for failed ones
  const processedFiles = files.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    // Fallback for failed URL generation
    const s = items[index];
    const normalizedFilename = extractFilename(s.filename || '');
    return {
      filename: normalizedFilename,
      url: s.url || '',
      username: s.username,
      domain: s.domain,
      deviceId: s.deviceId,
      mtime: (s.mtime as any)?.valueOf?.() || new Date(s.mtime as any).getTime(),
    };
  });

  // Return processed items with signed URLs in the items array for frontend compatibility
  return res.json({ items: processedFiles, total, page, limit, count: total, files: processedFiles });
}

export async function deleteScreenshot(req: Request, res: Response) {
  const { filename } = req.params;
  const normalizedFilename = extractFilename(filename);
  
  // Try to find by normalized filename first, then by original filename
  let shot = await ScreenshotModel.findOneAndDelete({ filename: normalizedFilename });
  if (!shot) {
    shot = await ScreenshotModel.findOneAndDelete({ filename });
  }
  if (!shot) return res.status(404).json({ error: 'not found' });

  // Require R2 storage - no filesystem fallback
  if (!r2Storage.isConfigured()) {
    return res.status(500).json({ error: 'R2 storage is not configured. Please set R2 environment variables.' });
  }

  // Delete from R2 bucket - try normalized filename first
  try {
    await r2Storage.deleteFile(normalizedFilename);
    console.log(`Successfully deleted screenshot from R2: ${normalizedFilename}`);
  } catch (error) {
    // Try original filename if normalized fails
    try {
      await r2Storage.deleteFile(filename);
      console.log(`Successfully deleted screenshot from R2: ${filename}`);
    } catch (error2) {
      console.error(`Failed to delete from R2: ${filename} (normalized: ${normalizedFilename})`, error2);
      // Continue even if R2 delete fails (file might already be deleted or not exist)
      // Database record is already deleted, so we return success
    }
  }

  return res.json({ success: true, ok: true, message: 'Screenshot deleted successfully', filename: normalizedFilename });
}

export async function bulkDeleteScreenshots(req: Request, res: Response) {
  const schema = z.object({ filenames: z.array(z.string()), user: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });

  const { filenames } = parsed.data;
  const result = await ScreenshotModel.deleteMany({ filename: { $in: filenames } });

  // Require R2 storage - no filesystem fallback
  if (!r2Storage.isConfigured()) {
    return res.status(500).json({ error: 'R2 storage is not configured. Please set R2 environment variables.' });
  }

  // Delete all files from R2 bucket
  const deleteResults = await Promise.all(
    filenames.map(async (f) => {
      const normalizedFilename = extractFilename(f);
      try {
        // Try normalized filename first
        await r2Storage.deleteFile(normalizedFilename);
        console.log(`Successfully deleted screenshot from R2: ${normalizedFilename}`);
        return { filename: normalizedFilename, success: true };
      } catch (error) {
        // Try original filename if normalized fails
        try {
          await r2Storage.deleteFile(f);
          console.log(`Successfully deleted screenshot from R2: ${f}`);
          return { filename: f, success: true };
        } catch (error2) {
          console.error(`Failed to delete from R2: ${f} (normalized: ${normalizedFilename})`, error2);
          return { filename: f, success: false, error: error2 };
        }
      }
    })
  );

  const successCount = deleteResults.filter((r) => r.success).length;
  if (successCount < filenames.length) {
    console.warn(`Some screenshots failed to delete from R2: ${successCount}/${filenames.length} succeeded`);
  }

  return res.json({ ok: true, deleted: result.deletedCount || 0 });
}


