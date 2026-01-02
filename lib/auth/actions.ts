"use server";

import { cookies } from "next/headers";
import { z } from "zod/v4";
import { prisma } from "../db";
import { sendWelcomeEmail } from "../email";
import { getUserOrganizations } from "./authorization";
import { hashPassword, passwordSchema, verifyPassword } from "./password";
import {
  createSession,
  deleteSession,
  SESSION_COOKIE_OPTIONS,
} from "./session";

/**
 * Sign up input validation
 */
const signUpSchema = z.object({
  email: z.email("Invalid email address"),
  password: passwordSchema,
});

/**
 * Sign in input validation
 */
const signInSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type AuthActionResult =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

/**
 * Server action for user sign up
 * Creates a user account, session, and sets the session cookie
 */
export async function signUp(data: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  // Validate input
  const parsed = signUpSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { email, password } = parsed.data;

  // Check if email is already taken
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return {
      success: false,
      error: "An account with this email already exists",
    };
  }

  // Hash password and create user with organization in a transaction
  const passwordHash = await hashPassword(password);

  const { session } = await prisma.$transaction(async (tx) => {
    // Create user
    const newUser = await tx.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    // Generate org name and slug from email
    const emailPrefix = email.split("@")[0];
    const orgName = `${emailPrefix}'s Organization`;
    const baseSlug = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const uniqueSlug = `${baseSlug}-${newUser.id.slice(-8)}`;

    // Create organization
    const newOrg = await tx.organization.create({
      data: {
        name: orgName,
        slug: uniqueSlug,
      },
    });

    // Create membership with owner role
    await tx.organizationMember.create({
      data: {
        userId: newUser.id,
        organizationId: newOrg.id,
        role: "owner",
      },
    });

    // Create session with the new org as current
    const newSession = await createSession(tx, newUser.id, newOrg.id);

    return { user: newUser, organization: newOrg, session: newSession };
  });

  // Send welcome email (fire and forget - don't block the signup flow)
  sendWelcomeEmail(email).catch((error) => {
    console.error("Failed to send welcome email:", error);
  });

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_OPTIONS.name, session.id, {
    httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
    secure: SESSION_COOKIE_OPTIONS.secure,
    sameSite: SESSION_COOKIE_OPTIONS.sameSite,
    path: SESSION_COOKIE_OPTIONS.path,
    maxAge: SESSION_COOKIE_OPTIONS.maxAge,
  });

  return { success: true, redirectTo: "/" };
}

/**
 * Server action for user sign in
 * Validates credentials, creates session, and sets the session cookie
 */
export async function signIn(data: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  // Validate input
  const parsed = signInSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { email, password } = parsed.data;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return { success: false, error: "Invalid email or password" };
  }

  // Get user's organizations to potentially set a default
  const orgs = await getUserOrganizations(prisma, user.id);
  const defaultOrgId = orgs.length === 1 ? orgs[0].id : null;

  // Create session
  const session = await createSession(prisma, user.id, defaultOrgId);

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_OPTIONS.name, session.id, {
    httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
    secure: SESSION_COOKIE_OPTIONS.secure,
    sameSite: SESSION_COOKIE_OPTIONS.sameSite,
    path: SESSION_COOKIE_OPTIONS.path,
    maxAge: SESSION_COOKIE_OPTIONS.maxAge,
  });

  return { success: true, redirectTo: "/" };
}

/**
 * Server action for user sign out
 * Invalidates the session and clears the cookie
 */
export async function signOut(): Promise<AuthActionResult> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_OPTIONS.name)?.value;

  if (sessionId) {
    await deleteSession(prisma, sessionId);
  }

  // Clear session cookie
  cookieStore.delete(SESSION_COOKIE_OPTIONS.name);

  return { success: true, redirectTo: "/sign-in" };
}

/**
 * Get current session from cookies (for server components)
 */
export async function getCurrentSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_OPTIONS.name)?.value;

  if (!sessionId) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isAdmin: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}
