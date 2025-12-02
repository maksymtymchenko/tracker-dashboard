import { Request, Response } from 'express';
import { z } from 'zod';
import { ScreenshotModel } from '../models/Screenshot.js';
import { r2Storage } from '../utils/r2Storage.js';

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
  const page = Number(req.query.page || 1);
  const limit = Math.min(100, Number(req.query.limit || 20));
  const user = req.query.user as string | undefined;

  const filter: Record<string, unknown> = {};
  if (user) filter.username = user;

  const [items, total] = await Promise.all([
    ScreenshotModel.find(filter).sort({ mtime: -1 }).skip((page - 1) * limit).limit(limit).lean(),
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


