import type { MemberRole, PrismaClient } from "../generated/prisma/client";

/**
 * Role hierarchy: owner > admin > member
 */
export const ROLE_HIERARCHY: Record<MemberRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

export type AuthResult =
  | { authorized: true; reason: "admin" | "role"; role?: MemberRole }
  | {
      authorized: false;
      reason: "unauthenticated" | "no_membership" | "insufficient_role";
    };

/**
 * Check if a role meets the minimum required role
 */
export function hasMinimumRole(
  userRole: MemberRole,
  requiredRole: MemberRole,
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if a role is included in a list of allowed roles
 */
export function hasRole(
  userRole: MemberRole,
  allowedRoles: MemberRole[],
): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Get all roles that meet a minimum role requirement
 */
export function getRolesAtOrAbove(minRole: MemberRole): MemberRole[] {
  const minLevel = ROLE_HIERARCHY[minRole];
  return (Object.entries(ROLE_HIERARCHY) as [MemberRole, number][])
    .filter(([, level]) => level >= minLevel)
    .map(([role]) => role);
}

/**
 * Authorize a user for an organization with specific roles
 *
 * @param prisma - Prisma client instance
 * @param userId - The user ID to check
 * @param organizationId - The organization to check access for
 * @param requiredRoles - Array of roles that are allowed (e.g., ['owner', 'admin'])
 * @returns AuthResult indicating authorization status
 */
export async function authorize(
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
  requiredRoles: MemberRole[],
): Promise<AuthResult> {
  // First, check if user exists and if they're an admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });

  if (!user) {
    return { authorized: false, reason: "unauthenticated" };
  }

  // Internal staff (admins) bypass tenant RBAC
  if (user.isAdmin) {
    return { authorized: true, reason: "admin" };
  }

  // Check tenant RBAC - get membership
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
    },
    select: { role: true },
  });

  if (!membership) {
    return { authorized: false, reason: "no_membership" };
  }

  // Check if user's role is in the allowed roles
  if (!hasRole(membership.role, requiredRoles)) {
    return { authorized: false, reason: "insufficient_role" };
  }

  return { authorized: true, reason: "role", role: membership.role };
}

/**
 * Authorize with minimum role requirement
 *
 * @param prisma - Prisma client instance
 * @param userId - The user ID to check
 * @param organizationId - The organization to check access for
 * @param minimumRole - The minimum role required (uses hierarchy)
 * @returns AuthResult indicating authorization status
 */
export async function authorizeMinimumRole(
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
  minimumRole: MemberRole,
): Promise<AuthResult> {
  const allowedRoles = getRolesAtOrAbove(minimumRole);
  return authorize(prisma, userId, organizationId, allowedRoles);
}

/**
 * Get user's role in an organization
 */
export async function getUserRole(
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
): Promise<MemberRole | null> {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  return membership?.role ?? null;
}

/**
 * Check if user is a member of an organization (any role)
 */
export async function isMemberOf(
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });
  return membership !== null;
}

/**
 * Check if user is an internal admin
 */
export async function isInternalAdmin(
  prisma: PrismaClient,
  userId: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  return user?.isAdmin ?? false;
}

/**
 * Get all organizations a user is a member of
 */
export async function getUserOrganizations(
  prisma: PrismaClient,
  userId: string,
): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    role: MemberRole;
  }>
> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
  }));
}
