import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { hasMinimumRole } from "../../lib/auth/authorization";
import { switchOrganization } from "../../lib/auth/session";
import { sendInvitationEmail } from "../../lib/email/send";
import {
  createTRPCRouter,
  orgProcedure,
  protectedProcedure,
  publicProcedure,
} from "../init";

/**
 * Generate a random token and its hash
 */
function generateToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

/**
 * Hash a token for lookup
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a URL-friendly slug from a name
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Invitation expiry time (7 days)
const INVITATION_EXPIRY_DAYS = 7;

/**
 * Input schemas
 */
const createOrgInput = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens",
    )
    .optional(),
});

const updateOrgInput = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .optional(),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens",
    )
    .optional(),
});

const inviteMemberInput = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member"]),
});

const updateMemberRoleInput = z.object({
  memberId: z.string().cuid(),
  role: z.enum(["admin", "member"]),
});

const removeMemberInput = z.object({
  memberId: z.string().cuid(),
});

const acceptInvitationInput = z.object({
  token: z.string().min(1),
});

const cancelInvitationInput = z.object({
  invitationId: z.string().cuid(),
});

/**
 * Organization router - handles organization and team management
 */
export const organizationRouter = createTRPCRouter({
  /**
   * Create a new organization
   * Creates the org and makes the current user the owner
   */
  create: protectedProcedure
    .input(createOrgInput)
    .mutation(async ({ ctx, input }) => {
      // Generate slug from name if not provided
      const baseSlug = input.slug ?? createSlug(input.name);
      let slug = baseSlug;
      let counter = 1;

      // Ensure slug is unique
      while (true) {
        const existing = await ctx.prisma.organization.findUnique({
          where: { slug },
        });
        if (!existing) break;
        slug = `${baseSlug}-${counter++}`;
      }

      // Create organization and membership in a transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: input.name,
            slug,
          },
        });

        await tx.organizationMember.create({
          data: {
            userId: ctx.user.id,
            organizationId: organization.id,
            role: "owner",
          },
        });

        return organization;
      });

      // Switch to the new organization
      await switchOrganization(ctx.prisma, ctx.session.id, result.id);

      return {
        id: result.id,
        name: result.name,
        slug: result.slug,
      };
    }),

  /**
   * Get current organization details
   */
  get: orgProcedure.query(async ({ ctx }) => {
    const org = await ctx.prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      include: {
        _count: {
          select: {
            members: true,
            todos: true,
          },
        },
      },
    });

    /* c8 ignore start */
    if (!org) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }
    /* c8 ignore stop */

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      memberCount: org._count.members,
      todoCount: org._count.todos,
      userRole: ctx.membership?.role ?? null,
    };
  }),

  /**
   * Update organization details
   * Only admins and owners can update
   */
  update: orgProcedure
    .input(updateOrgInput)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (ctx.membership && !hasMinimumRole(ctx.membership.role, "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins and owners can update organization settings",
        });
      }

      // Check slug uniqueness if changing
      if (input.slug) {
        const existing = await ctx.prisma.organization.findFirst({
          where: {
            slug: input.slug,
            id: { not: ctx.organizationId },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This slug is already taken",
          });
        }
      }

      const updated = await ctx.prisma.organization.update({
        where: { id: ctx.organizationId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.slug && { slug: input.slug }),
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
      };
    }),

  /**
   * Delete organization
   * Only owners can delete
   */
  delete: orgProcedure.mutation(async ({ ctx }) => {
    // Check permissions
    if (ctx.membership?.role !== "owner" && !ctx.user.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only owners can delete organizations",
      });
    }

    // Clear session org context before deletion
    await switchOrganization(ctx.prisma, ctx.session.id, null);

    await ctx.prisma.organization.delete({
      where: { id: ctx.organizationId },
    });

    return { success: true };
  }),

  /**
   * List organization members
   */
  listMembers: orgProcedure.query(async ({ ctx }) => {
    const members = await ctx.prisma.organizationMember.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: [
        { role: "asc" }, // owners first, then admins, then members
        { createdAt: "asc" },
      ],
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt,
      isCurrentUser: m.userId === ctx.user.id,
    }));
  }),

  /**
   * Update a member's role
   * Only owners and admins can update roles
   * Cannot change owner role or promote to owner
   */
  updateMemberRole: orgProcedure
    .input(updateMemberRoleInput)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (ctx.membership && !hasMinimumRole(ctx.membership.role, "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins and owners can change member roles",
        });
      }

      // Get the target member
      const targetMember = await ctx.prisma.organizationMember.findUnique({
        where: { id: input.memberId },
      });

      if (!targetMember || targetMember.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      // Cannot modify owner role
      if (targetMember.role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot change the owner's role",
        });
      }

      // Admins cannot promote to admin (only owners can)
      if (
        ctx.membership?.role === "admin" &&
        input.role === "admin" &&
        targetMember.role !== "admin"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can promote members to admin",
        });
      }

      const updated = await ctx.prisma.organizationMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
        include: {
          user: {
            select: { email: true },
          },
        },
      });

      return {
        id: updated.id,
        email: updated.user.email,
        role: updated.role,
      };
    }),

  /**
   * Remove a member from the organization
   * Owners can remove anyone, admins can remove members only
   * Cannot remove the owner or yourself
   */
  removeMember: orgProcedure
    .input(removeMemberInput)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (ctx.membership && !hasMinimumRole(ctx.membership.role, "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins and owners can remove members",
        });
      }

      // Get the target member
      const targetMember = await ctx.prisma.organizationMember.findUnique({
        where: { id: input.memberId },
      });

      if (!targetMember || targetMember.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      // Cannot remove owner
      if (targetMember.role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot remove the organization owner",
        });
      }

      // Admins cannot remove other admins
      if (ctx.membership?.role === "admin" && targetMember.role === "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admins cannot remove other admins",
        });
      }

      // Cannot remove yourself
      if (targetMember.userId === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot remove yourself from the organization",
        });
      }

      await ctx.prisma.organizationMember.delete({
        where: { id: input.memberId },
      });

      return { success: true };
    }),

  /**
   * Invite a member to the organization
   * Only admins and owners can invite
   */
  inviteMember: orgProcedure
    .input(inviteMemberInput)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (ctx.membership && !hasMinimumRole(ctx.membership.role, "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins and owners can invite members",
        });
      }

      // Admins cannot invite other admins
      if (ctx.membership?.role === "admin" && input.role === "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can invite admins",
        });
      }

      // Check if user is already a member
      const existingMember = await ctx.prisma.organizationMember.findFirst({
        where: {
          organizationId: ctx.organizationId,
          user: { email: input.email },
        },
      });

      if (existingMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This user is already a member of the organization",
        });
      }

      // Check for existing pending invitation
      const existingInvitation =
        await ctx.prisma.organizationInvitation.findFirst({
          where: {
            organizationId: ctx.organizationId,
            email: input.email,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
        });

      if (existingInvitation) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An invitation has already been sent to this email",
        });
      }

      // Generate token
      const { token, hash } = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

      // Delete any expired invitations for this email first
      await ctx.prisma.organizationInvitation.deleteMany({
        where: {
          organizationId: ctx.organizationId,
          email: input.email,
        },
      });

      // Create invitation
      const invitation = await ctx.prisma.organizationInvitation.create({
        data: {
          organizationId: ctx.organizationId,
          email: input.email,
          role: input.role,
          tokenHash: hash,
          invitedById: ctx.user.id,
          expiresAt,
        },
        include: {
          organization: {
            select: { name: true },
          },
        },
      });

      // Send invitation email
      try {
        await sendInvitationEmail(
          input.email,
          invitation.organization.name,
          ctx.user.email,
          token,
        );
      } catch (_error) {
        // Delete invitation if email fails
        await ctx.prisma.organizationInvitation.delete({
          where: { id: invitation.id },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send invitation email",
        });
      }

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      };
    }),

  /**
   * List pending invitations
   */
  listInvitations: orgProcedure.query(async ({ ctx }) => {
    // Only admins and owners can see invitations
    if (ctx.membership && !hasMinimumRole(ctx.membership.role, "admin")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins and owners can view invitations",
      });
    }

    const invitations = await ctx.prisma.organizationInvitation.findMany({
      where: {
        organizationId: ctx.organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: { email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      invitedBy: inv.invitedBy.email,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  }),

  /**
   * Cancel a pending invitation
   */
  cancelInvitation: orgProcedure
    .input(cancelInvitationInput)
    .mutation(async ({ ctx, input }) => {
      // Only admins and owners can cancel invitations
      if (ctx.membership && !hasMinimumRole(ctx.membership.role, "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins and owners can cancel invitations",
        });
      }

      const invitation = await ctx.prisma.organizationInvitation.findUnique({
        where: { id: input.invitationId },
      });

      if (!invitation || invitation.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (invitation.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation has already been accepted",
        });
      }

      await ctx.prisma.organizationInvitation.delete({
        where: { id: input.invitationId },
      });

      return { success: true };
    }),

  /**
   * Accept an invitation (public - user may not be logged in yet)
   */
  acceptInvitation: protectedProcedure
    .input(acceptInvitationInput)
    .mutation(async ({ ctx, input }) => {
      const tokenHash = hashToken(input.token);

      const invitation = await ctx.prisma.organizationInvitation.findFirst({
        where: {
          tokenHash,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired invitation",
        });
      }

      // Check if the invitation email matches the logged in user
      if (invitation.email !== ctx.user.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation was sent to a different email address",
        });
      }

      // Check if user is already a member
      const existingMember = await ctx.prisma.organizationMember.findFirst({
        where: {
          userId: ctx.user.id,
          organizationId: invitation.organizationId,
        },
      });

      if (existingMember) {
        // Mark invitation as accepted anyway
        await ctx.prisma.organizationInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });

        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already a member of this organization",
        });
      }

      // Create membership and mark invitation as accepted in transaction
      await ctx.prisma.$transaction(async (tx) => {
        await tx.organizationMember.create({
          data: {
            userId: ctx.user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        });

        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });
      });

      // Switch to the new organization
      await switchOrganization(
        ctx.prisma,
        ctx.session.id,
        invitation.organizationId,
      );

      return {
        organizationId: invitation.organization.id,
        organizationName: invitation.organization.name,
        role: invitation.role,
      };
    }),

  /**
   * Get invitation details by token (for display before accepting)
   */
  getInvitationByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const tokenHash = hashToken(input.token);

      const invitation = await ctx.prisma.organizationInvitation.findFirst({
        where: {
          tokenHash,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          organization: {
            select: { id: true, name: true },
          },
          invitedBy: {
            select: { email: true },
          },
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired invitation",
        });
      }

      return {
        email: invitation.email,
        organizationName: invitation.organization.name,
        role: invitation.role,
        invitedBy: invitation.invitedBy.email,
        expiresAt: invitation.expiresAt,
      };
    }),

  /**
   * Leave organization (self-removal)
   * Owners cannot leave - must transfer ownership first
   */
  leave: orgProcedure.mutation(async ({ ctx }) => {
    // Owners cannot leave
    if (ctx.membership?.role === "owner") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Owners cannot leave the organization. Transfer ownership first or delete the organization.",
      });
    }

    /* c8 ignore start */
    if (!ctx.membership) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "You are not a member of this organization",
      });
    }
    /* c8 ignore stop */

    // Clear session org context before leaving
    await switchOrganization(ctx.prisma, ctx.session.id, null);

    await ctx.prisma.organizationMember.delete({
      where: { id: ctx.membership.id },
    });

    return { success: true };
  }),

  /**
   * Transfer ownership to another member
   * Only current owner can transfer
   */
  transferOwnership: orgProcedure
    .input(z.object({ memberId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      // Only owners can transfer ownership
      if (ctx.membership?.role !== "owner" && !ctx.user.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the owner can transfer ownership",
        });
      }

      // Get the target member
      const targetMember = await ctx.prisma.organizationMember.findUnique({
        where: { id: input.memberId },
        include: {
          user: { select: { email: true } },
        },
      });

      if (!targetMember || targetMember.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      // Cannot transfer to self
      if (targetMember.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already own this organization",
        });
      }

      // Transfer ownership in transaction
      await ctx.prisma.$transaction(async (tx) => {
        // Demote current owner to admin
        if (ctx.membership) {
          await tx.organizationMember.update({
            where: { id: ctx.membership.id },
            data: { role: "admin" },
          });
        }

        // Promote target to owner
        await tx.organizationMember.update({
          where: { id: input.memberId },
          data: { role: "owner" },
        });
      });

      return {
        newOwnerEmail: targetMember.user.email,
        success: true,
      };
    }),
});
