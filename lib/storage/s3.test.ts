import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  AvatarKeys,
  createS3Client,
  deleteAvatar,
  getAvatar,
  getAvatarBucket,
  getAvatarUploadUrl,
  getAvatarUrl,
  getPublicBucket,
  isValidAvatarType,
  MAX_AVATAR_SIZE,
  SUPPORTED_AVATAR_TYPES,
  uploadAvatar,
} from "./s3";

describe("S3 storage", () => {
  // Use a unique prefix for test isolation
  const testPrefix = `test-${Date.now()}`;

  describe("AvatarKeys", () => {
    test("generates correct user avatar key", () => {
      const key = AvatarKeys.user("user123", "avatar456");
      expect(key).toBe("users/user123/avatar/avatar456");
    });

    test("generates correct organization avatar key", () => {
      const key = AvatarKeys.organization("org789", "avatar123");
      expect(key).toBe("orgs/org789/avatar/avatar123");
    });
  });

  describe("bucket configuration", () => {
    test("returns private bucket name", () => {
      const bucket = getAvatarBucket();
      expect(bucket).toBe("template-alpha-private");
    });

    test("returns public bucket name", () => {
      const bucket = getPublicBucket();
      expect(bucket).toBe("template-alpha-public");
    });
  });

  describe("avatar type validation", () => {
    test("accepts valid image types", () => {
      expect(isValidAvatarType("image/jpeg")).toBe(true);
      expect(isValidAvatarType("image/png")).toBe(true);
      expect(isValidAvatarType("image/gif")).toBe(true);
      expect(isValidAvatarType("image/webp")).toBe(true);
    });

    test("rejects invalid types", () => {
      expect(isValidAvatarType("image/svg+xml")).toBe(false);
      expect(isValidAvatarType("application/pdf")).toBe(false);
      expect(isValidAvatarType("text/plain")).toBe(false);
      expect(isValidAvatarType("")).toBe(false);
    });
  });

  describe("constants", () => {
    test("MAX_AVATAR_SIZE is 5MB", () => {
      expect(MAX_AVATAR_SIZE).toBe(5 * 1024 * 1024);
    });

    test("SUPPORTED_AVATAR_TYPES includes expected types", () => {
      expect(SUPPORTED_AVATAR_TYPES).toContain("image/jpeg");
      expect(SUPPORTED_AVATAR_TYPES).toContain("image/png");
      expect(SUPPORTED_AVATAR_TYPES).toContain("image/gif");
      expect(SUPPORTED_AVATAR_TYPES).toContain("image/webp");
      expect(SUPPORTED_AVATAR_TYPES).toHaveLength(4);
    });
  });

  describe("S3 operations", () => {
    const client = createS3Client();
    const testKey = `${testPrefix}/test-avatar.png`;

    // Simple PNG image (1x1 transparent pixel)
    const testImageData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );

    afterAll(async () => {
      // Cleanup test files
      try {
        await deleteAvatar(testKey, client);
      } catch {
        // Ignore cleanup errors
      }
    });

    test("uploadAvatar uploads file to S3", async () => {
      await uploadAvatar(testKey, testImageData, "image/png", client);

      // Verify by getting the avatar
      const result = await getAvatar(testKey, client);
      expect(result).not.toBeNull();
      expect(result?.contentType).toBe("image/png");
    });

    test("getAvatar retrieves uploaded file", async () => {
      const result = await getAvatar(testKey, client);

      expect(result).not.toBeNull();
      expect(result?.data).toBeInstanceOf(Uint8Array);
      expect(result?.data.length).toBeGreaterThan(0);
      expect(result?.contentType).toBe("image/png");
    });

    test("getAvatar returns null for non-existent key", async () => {
      const result = await getAvatar(
        `${testPrefix}/non-existent-avatar.png`,
        client,
      );
      expect(result).toBeNull();
    });

    test("getAvatarUrl generates presigned URL", async () => {
      const url = await getAvatarUrl(testKey, 3600, client);

      expect(url).toBeTypeOf("string");
      expect(url).toContain("X-Amz-Signature");
      expect(url).toContain(testKey);
    });

    test("getAvatarUploadUrl generates presigned upload URL", async () => {
      const uploadKey = `${testPrefix}/upload-test.png`;
      const url = await getAvatarUploadUrl(uploadKey, "image/png", 300, client);

      expect(url).toBeTypeOf("string");
      expect(url).toContain("X-Amz-Signature");
      expect(url).toContain(uploadKey);
    });

    test("deleteAvatar removes file from S3", async () => {
      const deleteKey = `${testPrefix}/delete-test.png`;

      // Upload first
      await uploadAvatar(deleteKey, testImageData, "image/png", client);

      // Verify it exists
      const beforeDelete = await getAvatar(deleteKey, client);
      expect(beforeDelete).not.toBeNull();

      // Delete
      await deleteAvatar(deleteKey, client);

      // Verify it's gone
      const afterDelete = await getAvatar(deleteKey, client);
      expect(afterDelete).toBeNull();
    });

    test("deleteAvatar does not throw for non-existent key", async () => {
      // Should not throw
      await deleteAvatar(`${testPrefix}/never-existed.png`, client);
    });
  });

  describe("createS3Client", () => {
    test("creates client with default config", () => {
      const client = createS3Client();
      expect(client).toBeDefined();
    });

    test("creates client with custom config", () => {
      const client = createS3Client({
        endpoint: "http://custom-endpoint:9000",
        accessKey: "custom-access",
        secretKey: "custom-secret",
      });
      expect(client).toBeDefined();
    });
  });
});
