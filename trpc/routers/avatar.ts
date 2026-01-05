import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { hasMinimumRole } from "../../lib/auth/authorization";
import {
  AvatarKeys,
  deleteAvatar,
  getAvatarUploadUrl,
  getAvatarUrl,
  MAX_AVATAR_SIZE,
  SUPPORTED_AVATAR_TYPES,
  uploadAvatar,
} from "../../lib/storage";
import { auth, orgContext, tmid, withPrisma } from "../../lib/trpc";
import { createTRPCRouter, publicProcedure } from "../init";

/**
 * Generate a CUID-like ID for avatars
 */
function generateAvatarId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `av${timestamp}${randomPart}`;
}

/**
 * Input schema for requesting upload URL
 */
const getUploadUrlInput = z.object({
  contentType: z.enum(SUPPORTED_AVATAR_TYPES),
  size: z.number().max(MAX_AVATAR_SIZE, "File too large (max 5MB)"),
});

/**
 * Input schema for direct upload (base64 encoded)
 */
const uploadAvatarInput = z.object({
  data: z.string().min(1, "Avatar data is required"),
  contentType: z.enum(SUPPORTED_AVATAR_TYPES),
});

/**
 * Avatar router - handles avatar upload/download for users and organizations
 */
export const avatarRouter = createTRPCRouter({
  /**
   * Get presigned URL for uploading user avatar
   * Returns a URL that can be used to PUT the avatar directly to S3
   */
  getUserUploadUrl: publicProcedure
    .input(getUploadUrlInput)
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .build(async ({ session }) => {
          const avatarId = generateAvatarId();
          const key = AvatarKeys.user(session.user.id, avatarId);

          const uploadUrl = await getAvatarUploadUrl(key, input.contentType);

          return {
            uploadUrl,
            avatarId,
            key,
          };
        });
    }),

  /**
   * Upload user avatar directly (base64 encoded)
   * For smaller avatars that can be sent in the request body
   */
  uploadUserAvatar: publicProcedure
    .input(uploadAvatarInput)
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .build(async ({ prisma, session }) => {
          // Decode base64 data
          const buffer = Buffer.from(input.data, "base64");

          if (buffer.length > MAX_AVATAR_SIZE) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "File too large (max 5MB)",
            });
          }

          // Get current user to check for existing avatar
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { avatarId: true },
          });

          // Delete old avatar if exists
          if (user?.avatarId) {
            const oldKey = AvatarKeys.user(session.user.id, user.avatarId);
            try {
              await deleteAvatar(oldKey);
            } catch {
              // Ignore deletion errors for old avatar
            }
          }

          // Generate new avatar ID and upload
          const avatarId = generateAvatarId();
          const key = AvatarKeys.user(session.user.id, avatarId);

          await uploadAvatar(key, buffer, input.contentType);

          // Update user with new avatar ID
          await prisma.user.update({
            where: { id: session.user.id },
            data: { avatarId },
          });

          return {
            avatarId,
            avatarUrl: await getAvatarUrl(key),
          };
        });
    }),

  /**
   * Confirm user avatar upload (after presigned URL upload)
   * Updates the user's avatarId in the database
   */
  confirmUserAvatar: publicProcedure
    .input(z.object({ avatarId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .build(async ({ prisma, session }) => {
          // Get current user to check for existing avatar
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { avatarId: true },
          });

          // Delete old avatar if exists and different from new one
          if (user?.avatarId && user.avatarId !== input.avatarId) {
            const oldKey = AvatarKeys.user(session.user.id, user.avatarId);
            try {
              await deleteAvatar(oldKey);
            } catch {
              // Ignore deletion errors for old avatar
            }
          }

          // Update user with new avatar ID
          await prisma.user.update({
            where: { id: session.user.id },
            data: { avatarId: input.avatarId },
          });

          const key = AvatarKeys.user(session.user.id, input.avatarId);

          return {
            avatarId: input.avatarId,
            avatarUrl: await getAvatarUrl(key),
          };
        });
    }),

  /**
   * Delete user avatar
   */
  deleteUserAvatar: publicProcedure.mutation(async () => {
    return tmid()
      .use(withPrisma())
      .use(auth())
      .build(async ({ prisma, session }) => {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { avatarId: true },
        });

        if (!user?.avatarId) {
          return { success: true };
        }

        const key = AvatarKeys.user(session.user.id, user.avatarId);

        try {
          await deleteAvatar(key);
        } catch {
          // Ignore S3 deletion errors
        }

        await prisma.user.update({
          where: { id: session.user.id },
          data: { avatarId: null },
        });

        return { success: true };
      });
  }),

  /**
   * Get current user's avatar URL
   */
  getUserAvatarUrl: publicProcedure.query(async () => {
    return tmid()
      .use(withPrisma())
      .use(auth())
      .build(async ({ prisma, session }) => {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { avatarId: true },
        });

        if (!user?.avatarId) {
          return { avatarUrl: null };
        }

        const key = AvatarKeys.user(session.user.id, user.avatarId);
        const avatarUrl = await getAvatarUrl(key);

        return { avatarUrl };
      });
  }),

  /**
   * Get presigned URL for uploading organization avatar
   * Only admins and owners can upload org avatars
   */
  getOrgUploadUrl: publicProcedure
    .input(getUploadUrlInput)
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .use(orgContext())
        .build(async ({ organizationId, membership }) => {
          // Check permissions
          if (membership && !hasMinimumRole(membership.role, "admin")) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Only admins and owners can upload organization avatars",
            });
          }

          const avatarId = generateAvatarId();
          const key = AvatarKeys.organization(organizationId, avatarId);

          const uploadUrl = await getAvatarUploadUrl(key, input.contentType);

          return {
            uploadUrl,
            avatarId,
            key,
          };
        });
    }),

  /**
   * Upload organization avatar directly (base64 encoded)
   */
  uploadOrgAvatar: publicProcedure
    .input(uploadAvatarInput)
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .use(orgContext())
        .build(async ({ prisma, organizationId, membership }) => {
          // Check permissions
          if (membership && !hasMinimumRole(membership.role, "admin")) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Only admins and owners can upload organization avatars",
            });
          }

          // Decode base64 data
          const buffer = Buffer.from(input.data, "base64");

          if (buffer.length > MAX_AVATAR_SIZE) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "File too large (max 5MB)",
            });
          }

          // Get current org to check for existing avatar
          const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { avatarId: true },
          });

          // Delete old avatar if exists
          if (org?.avatarId) {
            const oldKey = AvatarKeys.organization(
              organizationId,
              org.avatarId,
            );
            try {
              await deleteAvatar(oldKey);
            } catch {
              // Ignore deletion errors for old avatar
            }
          }

          // Generate new avatar ID and upload
          const avatarId = generateAvatarId();
          const key = AvatarKeys.organization(organizationId, avatarId);

          await uploadAvatar(key, buffer, input.contentType);

          // Update org with new avatar ID
          await prisma.organization.update({
            where: { id: organizationId },
            data: { avatarId },
          });

          return {
            avatarId,
            avatarUrl: await getAvatarUrl(key),
          };
        });
    }),

  /**
   * Confirm organization avatar upload (after presigned URL upload)
   */
  confirmOrgAvatar: publicProcedure
    .input(z.object({ avatarId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .use(orgContext())
        .build(async ({ prisma, organizationId, membership }) => {
          // Check permissions
          if (membership && !hasMinimumRole(membership.role, "admin")) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Only admins and owners can update organization avatars",
            });
          }

          // Get current org to check for existing avatar
          const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { avatarId: true },
          });

          // Delete old avatar if exists and different from new one
          if (org?.avatarId && org.avatarId !== input.avatarId) {
            const oldKey = AvatarKeys.organization(
              organizationId,
              org.avatarId,
            );
            try {
              await deleteAvatar(oldKey);
            } catch {
              // Ignore deletion errors for old avatar
            }
          }

          // Update org with new avatar ID
          await prisma.organization.update({
            where: { id: organizationId },
            data: { avatarId: input.avatarId },
          });

          const key = AvatarKeys.organization(organizationId, input.avatarId);

          return {
            avatarId: input.avatarId,
            avatarUrl: await getAvatarUrl(key),
          };
        });
    }),

  /**
   * Delete organization avatar
   */
  deleteOrgAvatar: publicProcedure.mutation(async () => {
    return tmid()
      .use(withPrisma())
      .use(auth())
      .use(orgContext())
      .build(async ({ prisma, organizationId, membership }) => {
        // Check permissions
        if (membership && !hasMinimumRole(membership.role, "admin")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins and owners can delete organization avatars",
          });
        }

        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { avatarId: true },
        });

        if (!org?.avatarId) {
          return { success: true };
        }

        const key = AvatarKeys.organization(organizationId, org.avatarId);

        try {
          await deleteAvatar(key);
        } catch {
          // Ignore S3 deletion errors
        }

        await prisma.organization.update({
          where: { id: organizationId },
          data: { avatarId: null },
        });

        return { success: true };
      });
  }),

  /**
   * Get current organization's avatar URL
   */
  getOrgAvatarUrl: publicProcedure.query(async () => {
    return tmid()
      .use(withPrisma())
      .use(auth())
      .use(orgContext())
      .build(async ({ prisma, organizationId }) => {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { avatarId: true },
        });

        if (!org?.avatarId) {
          return { avatarUrl: null };
        }

        const key = AvatarKeys.organization(organizationId, org.avatarId);
        const avatarUrl = await getAvatarUrl(key);

        return { avatarUrl };
      });
  }),

  /**
   * Get supported avatar types and size limits
   */
  getConfig: publicProcedure.query(() => {
    return {
      supportedTypes: SUPPORTED_AVATAR_TYPES,
      maxSize: MAX_AVATAR_SIZE,
      maxSizeFormatted: "5MB",
    };
  }),
});
