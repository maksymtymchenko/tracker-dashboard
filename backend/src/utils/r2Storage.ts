import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 Storage Service
 * Uses S3-compatible API since R2 is S3-compatible
 */
class R2Storage {
  private client: S3Client | null = null;
  private bucketName: string;
  private publicUrl?: string;
  private signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || 'screenshots';
    
    // Initialize S3 client for R2 if credentials are provided
    if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      
      // Public URL for R2 custom domain or public bucket
      // Format: https://your-domain.com or https://bucket-name.account-id.r2.cloudflarestorage.com
      this.publicUrl = process.env.R2_PUBLIC_URL || 
        `https://${this.bucketName}.${accountId}.r2.cloudflarestorage.com`;
    }
  }

  /**
   * Check if R2 is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Upload a file to R2
   */
  async uploadFile(key: string, buffer: Buffer, contentType: string = 'image/png'): Promise<string> {
    if (!this.client) {
      throw new Error('R2 storage is not configured. Please set R2 environment variables.');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);

    // Return public URL if configured, otherwise generate a signed URL
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }

    // Generate a signed URL that's valid for 1 hour
    return this.getSignedUrlCached(key, 3600);
  }

  /**
   * Generate a signed URL for a file (valid for 1 hour by default)
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.client) {
      throw new Error('R2 storage is not configured.');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Generate a signed URL with a short-lived in-memory cache.
   */
  async getSignedUrlCached(key: string, expiresIn: number = 3600): Promise<string> {
    const cached = this.signedUrlCache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.url;
    }

    const url = await this.getSignedUrl(key, expiresIn);
    const ttlMs = Math.max(0, expiresIn * 1000 - 30000);
    if (ttlMs > 0) {
      this.signedUrlCache.set(key, { url, expiresAt: now + ttlMs });
    }
    return url;
  }

  /**
   * Delete a file from R2
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.client) {
      throw new Error('R2 storage is not configured.');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Get the public URL for a file (if public bucket is configured)
   */
  getPublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    throw new Error('Public URL is not configured for R2 storage.');
  }
}

// Export singleton instance
export const r2Storage = new R2Storage();
