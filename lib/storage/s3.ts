import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * S3 configuration from environment variables
 */
const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:52871";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? "minioadmin";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? "minioadmin";
const S3_BUCKET_PUBLIC =
  process.env.S3_BUCKET_PUBLIC ?? "template-alpha-public";
const S3_BUCKET_PRIVATE =
  process.env.S3_BUCKET_PRIVATE ?? "template-alpha-private";

/**
 * S3 client singleton
 */
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: "us-east-1", // Required but ignored by MinIO
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return s3Client;
}

/**
 * Create a new S3 client for testing (allows custom config)
 */
export function createS3Client(config?: {
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
}): S3Client {
  return new S3Client({
    endpoint: config?.endpoint ?? S3_ENDPOINT,
    region: "us-east-1",
    credentials: {
      accessKeyId: config?.accessKey ?? S3_ACCESS_KEY,
      secretAccessKey: config?.secretKey ?? S3_SECRET_KEY,
    },
    forcePathStyle: true,
  });
}

/**
 * Get the bucket name for avatars (private bucket)
 */
export function getAvatarBucket(): string {
  return S3_BUCKET_PRIVATE;
}

/**
 * Get the public bucket name
 */
export function getPublicBucket(): string {
  return S3_BUCKET_PUBLIC;
}

/**
 * Avatar storage key strategies
 */
export const AvatarKeys = {
  /**
   * Key for user avatar
   * Format: users/{userId}/avatar/{avatarId}
   */
  user(userId: string, avatarId: string): string {
    return `users/${userId}/avatar/${avatarId}`;
  },

  /**
   * Key for organization avatar
   * Format: orgs/{orgId}/avatar/{avatarId}
   */
  organization(orgId: string, avatarId: string): string {
    return `orgs/${orgId}/avatar/${avatarId}`;
  },
} as const;

/**
 * Upload avatar to S3
 */
export async function uploadAvatar(
  key: string,
  data: Buffer | Uint8Array,
  contentType: string,
  client?: S3Client,
): Promise<void> {
  const s3 = client ?? getS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_PRIVATE,
      Key: key,
      Body: data,
      ContentType: contentType,
    }),
  );
}

/**
 * Delete avatar from S3
 */
export async function deleteAvatar(
  key: string,
  client?: S3Client,
): Promise<void> {
  const s3 = client ?? getS3Client();

  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET_PRIVATE,
      Key: key,
    }),
  );
}

/**
 * Get avatar data from S3
 */
export async function getAvatar(
  key: string,
  client?: S3Client,
): Promise<{ data: Uint8Array; contentType: string } | null> {
  const s3 = client ?? getS3Client();

  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET_PRIVATE,
        Key: key,
      }),
    );

    if (!response.Body) {
      return null;
    }

    const data = await response.Body.transformToByteArray();
    const contentType = response.ContentType ?? "image/png";

    return { data, contentType };
  } catch (error: unknown) {
    // Handle not found
    if (
      error instanceof Error &&
      "name" in error &&
      error.name === "NoSuchKey"
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Generate a presigned URL for downloading avatar
 * The URL expires after the specified duration (default: 1 hour)
 */
export async function getAvatarUrl(
  key: string,
  expiresInSeconds = 3600,
  client?: S3Client,
): Promise<string> {
  const s3 = client ?? getS3Client();

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_PRIVATE,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a presigned URL for uploading avatar
 * The URL expires after the specified duration (default: 5 minutes)
 */
export async function getAvatarUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300,
  client?: S3Client,
): Promise<string> {
  const s3 = client ?? getS3Client();

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_PRIVATE,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Supported image content types for avatars
 */
export const SUPPORTED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type SupportedAvatarType = (typeof SUPPORTED_AVATAR_TYPES)[number];

/**
 * Maximum avatar file size (5MB)
 */
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

/**
 * Validate avatar content type
 */
export function isValidAvatarType(
  contentType: string,
): contentType is SupportedAvatarType {
  return SUPPORTED_AVATAR_TYPES.includes(contentType as SupportedAvatarType);
}
