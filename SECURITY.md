# Security Architecture

This document describes the authentication and authorization system implemented in this codebase, explains design decisions, identifies potential vulnerabilities, and provides guidance for AI agents working with the security system.

## Overview

The application uses **session-based authentication** with **role-based access control (RBAC)** for multi-tenant data isolation. Key components:

| Component | Location | Purpose |
|-----------|----------|---------|
| Password handling | `lib/auth/password.ts` | bcrypt hashing and validation |
| Session management | `lib/auth/session.ts` | Session lifecycle and cookies |
| Authorization | `lib/auth/authorization.ts` | RBAC with role hierarchy |
| Password reset | `lib/auth/password-reset.ts` | Secure token-based reset flow |
| Server actions | `lib/auth/actions.ts` | Next.js server actions for auth flows |
| tRPC middleware | `lib/trpc/middlewares/` | Request authentication and org context |

## Authentication Flow

### Sign Up (`lib/auth/actions.ts:45`)

```
1. Validate input (Zod schema: email format, password complexity)
2. Normalize email to lowercase
3. Check for existing account
4. Hash password with bcrypt (12 rounds)
5. Create user, organization, and membership in transaction
6. Create session (7-day expiration)
7. Set httpOnly cookie with session ID
8. Send welcome email (fire-and-forget)
```

### Sign In (`lib/auth/actions.ts:137`)

```
1. Validate input format
2. Normalize email to lowercase
3. Look up user by email
4. Verify password against bcrypt hash
5. Get user's organizations
6. Create session (default org if only one)
7. Set httpOnly cookie
```

### Session Validation (every request)

```
1. Extract session_id from cookies
2. Look up session in database
3. Check expiration (7-day window)
4. Delete expired sessions automatically
5. Return session with user data or null
```

## Security Measures

### Password Security

| Measure | Implementation | Location |
|---------|----------------|----------|
| **Hashing** | bcrypt with 12 salt rounds | `lib/auth/password.ts:4` |
| **Complexity** | Min 8 chars, uppercase, lowercase, number | `lib/auth/password.ts:14-19` |
| **Timing attacks** | bcrypt.compare handles constant-time | `lib/auth/password.ts:50` |

**Why 12 rounds?** Industry standard balancing security and performance. Each round doubles the work factor; 12 rounds takes ~250ms on typical hardware.

### Session Security

| Measure | Value | Location |
|---------|-------|----------|
| **httpOnly** | `true` | `lib/auth/session.ts:34` |
| **secure** | `true` in production | `lib/auth/session.ts:35` |
| **sameSite** | `lax` | `lib/auth/session.ts:36` |
| **maxAge** | 7 days | `lib/auth/session.ts:38` |
| **path** | `/` | `lib/auth/session.ts:37` |

**Why these settings?**
- `httpOnly`: Prevents JavaScript access, mitigating XSS attacks
- `secure`: Ensures cookies only sent over HTTPS in production
- `sameSite=lax`: Prevents CSRF while allowing cross-site navigation
- 7-day expiration: Balance between UX (not logging out too often) and security

### Password Reset Flow

| Measure | Implementation | Location |
|---------|----------------|----------|
| **Token generation** | 32 bytes crypto random (64-char hex) | `lib/auth/password-reset.ts:59-61` |
| **Token storage** | SHA-256 hash (not plaintext) | `lib/auth/password-reset.ts:67-69` |
| **Token validity** | 1 hour | `lib/auth/password-reset.ts:19` |
| **One-time use** | `usedAt` timestamp marks usage | `lib/auth/password-reset.ts:209-212` |
| **Previous token invalidation** | New request invalidates old tokens | `lib/auth/password-reset.ts:112` |
| **Email enumeration protection** | Always returns success | `lib/auth/actions.ts:283` |
| **Atomic operations** | Transaction for password update + token marking | `lib/auth/password-reset.ts:166` |

**Why SHA-256 for reset tokens?** Tokens are already high-entropy (256 bits), so SHA-256 provides fast, secure one-way hashing. bcrypt would be overkill and slow for already-random tokens.

### Authorization (RBAC)

| Role | Level | Permissions |
|------|-------|-------------|
| `owner` | 3 | Full organization control |
| `admin` | 2 | Manage members, resources |
| `member` | 1 | Basic access |

**Role hierarchy** (`lib/auth/authorization.ts:6-10`): Higher levels include all permissions of lower levels.

**Internal admin bypass** (`lib/auth/authorization.ts:75`): Users with `isAdmin=true` bypass tenant RBAC checks entirely.

### Multi-Tenant Isolation

Data isolation is enforced at the middleware level:

1. **auth middleware** (`lib/trpc/middlewares/auth.ts`): Requires valid session
2. **orgContext middleware** (`lib/trpc/middlewares/org.ts`): Requires active org + membership verification

```typescript
// Every org-scoped procedure must use both middlewares
tmid()
  .use(auth())
  .use(orgContext())
  .build(async ({ session, organizationId, membership }) => {
    // Only executes if user is authenticated AND member of org
  });
```

## Potential Vulnerabilities

### Currently Addressed

| Risk | Mitigation |
|------|------------|
| Password storage | bcrypt with 12 rounds |
| Session hijacking | httpOnly cookies |
| CSRF | sameSite=lax |
| Email enumeration | Always-success responses |
| Token replay | One-time use enforcement |
| SQL injection | Prisma parameterized queries |
| XSS via cookies | httpOnly flag |

### Areas for Future Enhancement

| Risk | Current State | Recommendation |
|------|---------------|----------------|
| **Rate limiting** | Not implemented | Add rate limiting to login, signup, password reset |
| **Account lockout** | Not implemented | Lock after N failed attempts |
| **Session fixation** | No pre/post-auth rotation | Rotate session ID after login |
| **2FA/MFA** | Not implemented | Add TOTP or WebAuthn support |
| **Password history** | Not tracked | Prevent password reuse |
| **Login notifications** | Not implemented | Email on new session creation |
| **Concurrent session limit** | Unlimited | Consider limiting active sessions |
| **Session revocation UI** | Not implemented | Allow users to view/revoke sessions |
| **CSRF tokens** | Relies on sameSite only | Consider adding explicit tokens for sensitive actions |

### Known Limitations

1. **Session expiration is fixed**: No sliding window; sessions always expire 7 days after creation (though `lastAccessedAt` is tracked)

2. **No refresh tokens**: Single session token handles both authentication and session continuity

3. **Admin bypass is absolute**: Internal admins (`isAdmin=true`) can access any organization without membership verification

## AI Agent Guidelines

### Working with Auth Code

**DO:**
- Use the test harness (`lib/test/harness.ts`) for auth testing
- Test both authenticated and unauthenticated paths
- Verify RBAC by testing with different role levels
- Use `ctx.signIn(user, orgId)` to create authenticated test sessions

**DON'T:**
- Mock the database - always test against real PostgreSQL
- Bypass middleware chains - always include `auth()` before `orgContext()`
- Store plaintext passwords or tokens
- Return different error messages for valid vs invalid emails

### Common Pitfalls

1. **Forgetting middleware order**: `orgContext()` must come after `auth()`
   ```typescript
   // CORRECT
   tmid().use(auth()).use(orgContext()).build(...)

   // WRONG - will fail
   tmid().use(orgContext()).use(auth()).build(...)
   ```

2. **Missing org context**: Some procedures need org context, some don't
   ```typescript
   // Org-scoped (needs orgContext)
   todo.list, todo.create, organization.getMembers

   // User-scoped (only needs auth)
   auth.me, auth.getOrganizations, user.updateProfile
   ```

3. **Testing admin bypass**: Remember `isAdmin` users bypass org checks
   ```typescript
   // This will pass even without membership:
   const admin = await ctx.createUser({ isAdmin: true });
   const session = await ctx.signIn(admin, someOrgId);
   // Admin can access any org
   ```

4. **Email normalization**: Always use `normalizeEmail()` for lookups
   ```typescript
   import { normalizeEmail } from "./email";
   const user = await prisma.user.findUnique({
     where: { email: normalizeEmail(input.email) }
   });
   ```

### Testing Auth Flows

```typescript
import { createTestContext, withTestContext } from "../lib/test/harness";

// Test sign-in
await withTestContext(async (ctx) => {
  const user = await ctx.createUser({ password: "Test123!" });
  const session = await ctx.signIn(user);
  // session.id can be used for authenticated requests
});

// Test RBAC
await withTestContext(async (ctx) => {
  const { user, org, membership } = await ctx.createUserWithOrg({ role: "member" });
  const session = await ctx.signIn(user, org.id);

  // Test that member cannot perform admin actions
  await expect(caller.organization.deleteOrganization()).rejects.toThrow();
});

// Test multi-tenant isolation
await withTestContext(async (ctx) => {
  const { user: user1, org: org1 } = await ctx.createUserWithOrg();
  const { user: user2, org: org2 } = await ctx.createUserWithOrg();

  const session1 = await ctx.signIn(user1, org1.id);
  // user1 should NOT see user2's data
});
```

### Adding New Protected Routes

1. **Decide auth level**: Does it need auth? Org context? Specific role?

2. **Choose middleware chain**:
   ```typescript
   // Public (no auth)
   tmid().build(async (ctx) => { ... });

   // Authenticated only
   tmid().use(auth()).build(async ({ session }) => { ... });

   // Org-scoped
   tmid().use(auth()).use(orgContext()).build(async ({ session, organizationId }) => { ... });

   // Admin only
   tmid().use(auth()).use(admin()).build(async ({ session }) => { ... });
   ```

3. **Add RBAC check if needed**:
   ```typescript
   import { authorizeMinimumRole } from "../../auth/authorization";

   // Inside handler
   const authResult = await authorizeMinimumRole(
     prisma, session.user.id, organizationId, "admin"
   );
   if (!authResult.authorized) {
     throw new TRPCError({ code: "FORBIDDEN" });
   }
   ```

## File Reference

| File | Purpose |
|------|---------|
| `lib/auth/password.ts` | bcrypt hashing, password validation schema |
| `lib/auth/session.ts` | Session CRUD, cookie configuration |
| `lib/auth/authorization.ts` | RBAC utilities, role hierarchy |
| `lib/auth/password-reset.ts` | Reset token generation/validation |
| `lib/auth/actions.ts` | Server actions (signup, signin, signout) |
| `lib/auth/email.ts` | Email normalization |
| `lib/trpc/middlewares/auth.ts` | Authentication middleware |
| `lib/trpc/middlewares/org.ts` | Organization context middleware |
| `lib/trpc/middlewares/admin.ts` | Admin-only middleware |
| `lib/trpc/middlewares/session.ts` | Session provider for tRPC context |
| `prisma/user.prisma` | User model schema |
| `prisma/session.prisma` | Session model schema |
| `prisma/password-reset.prisma` | Password reset token schema |
| `prisma/organization.prisma` | Organization and membership schemas |
