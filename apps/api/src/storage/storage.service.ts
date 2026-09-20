import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const UPLOAD_FOLDERS = ['products', 'categories', 'content'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

const UPLOAD_URL_TTL_SECONDS = 300;
const REQUIRED_SETTINGS = ['AWS_REGION', 'S3_BUCKET', 'S3_PUBLIC_URL'] as const;

// Images live in S3. The API only signs upload URLs; the browser sends the
// file straight to the bucket, so image bytes never pass through this server.
@Injectable()
export class StorageService {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  async createUpload(folder: UploadFolder, contentType: string) {
    const { client, bucket, publicUrl } = this.settings();
    const key = `${folder}/${randomUUID()}.${IMAGE_TYPES[contentType]}`;
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );

    return { key, uploadUrl, publicUrl: `${publicUrl}/${key}` };
  }

  // Checked on use rather than at boot, so the rest of the API runs before a
  // bucket exists; only uploads report that storage is not set up.
  private settings() {
    const missing = REQUIRED_SETTINGS.filter((name) => !this.config.get(name));
    if (missing.length > 0) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_NOT_CONFIGURED',
        message: `Image storage is not set up. Missing in the API .env: ${missing.join(', ')}`,
      });
    }

    // Credentials come from the AWS SDK default chain
    // (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, or an instance role).
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    this.client ??= new S3Client({
      region: this.config.get<string>('AWS_REGION'),
      // Set only for S3-compatible servers (MinIO, a local stand-in).
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });

    return {
      client: this.client,
      bucket: this.config.get<string>('S3_BUCKET')!,
      publicUrl: this.config.get<string>('S3_PUBLIC_URL')!.replace(/\/$/, ''),
    };
  }
}
