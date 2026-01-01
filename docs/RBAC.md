# RBAC System Documentation

A home-rolled Role-Based Access Control (RBAC) system for multi-tenant applications with internal staff support.

## Overview

This MVP authentication and authorization system provides:

- User self-registration with automatic organization creation
- Multi-tenant architecture at its core
- Role-based access control (RBAC) for tenant users
- Internal staff access via simple admin flag (customer support)
- Email/password authentication
- Session-based authentication (no JWTs)

## User Types

The system distinguishes between two categories of users:

### 1. Tenant Users (Customers)

Regular users who sign up and belong to organizations. They operate within the tenant RBAC system.

### 2. Internal Staff (Company Employees)

Company employees (customer support, operations, etc.) who need cross-tenant access. These users have a simple `is_admin` flag on their user record—**no separate RBAC system**.

```
┌─────────────────────────────────────────────────────────────┐
│                        Users                                │
├─────────────────────────────┬───────────────────────────────┤
│       Tenant Users          │        Internal Staff         │
├─────────────────────────────┼───────────────────────────────┤
│ • Belong to organizations   │ • is_admin = true             │
│ • Have org roles (RBAC)     │ • No RBAC, just the flag      │
│ • Scoped to their tenant    │ • Cross-tenant access         │
│ • Self-service signup       │ • Created by other admins     │
└─────────────────────────────┴───────────────────────────────┘
```

## Core Concepts

### Multi-Tenancy

Every tenant user belongs to an **Organization**. When a user signs up:

1. A new organization is created
2. The user is assigned as the **owner** of that organization
3. All subsequent resources are scoped to the organization

This ensures complete data isolation between tenants.

### Internal Staff Access

Internal staff (customer support) bypass tenant RBAC entirely:

- Single `is_admin` boolean flag on the user record
- Can access any organization's data for support purposes
- Cannot be created via self-signup (must be provisioned)
- Audit logging should track all admin actions

### Tenant RBAC Model

For regular tenant users:

```
User → Membership → Organization
           ↓
         Role (owner/admin/member)
```

**Default Roles:**

| Role   | Description                              |
| ------ | ---------------------------------------- |
| owner  | Full access, can manage org and members  |
| admin  | Can manage members and resources         |
| member | Standard access to organization resources|

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,  -- Internal staff flag
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
```

### Organizations Table

```sql
CREATE TABLE organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
```

### Organization Members Table

```sql
CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
```

### Sessions Table

```sql
CREATE TABLE sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_org_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
  expires_at          TIMESTAMP NOT NULL,
  created_at          TIMESTAMP DEFAULT NOW(),
  last_accessed_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

## Session Management

### Session Architecture

Sessions are stored server-side in the database. The client receives only a session ID via a secure, httpOnly cookie.

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │  ──────▶│   Server    │  ──────▶│  Database   │
│             │         │             │         │             │
│ Cookie:     │         │ Lookup      │         │ sessions    │
│ session_id  │         │ session_id  │         │ table       │
└─────────────┘         └─────────────┘         └─────────────┘
```

### Session Cookie Configuration

```typescript
const SESSION_COOKIE_OPTIONS = {
  name: 'session_id',
  httpOnly: true,      // Not accessible via JavaScript
  secure: true,        // HTTPS only (disable for local dev)
  sameSite: 'lax',     // CSRF protection
  path: '/',
  maxAge: 60 * 60 * 24 * 7  // 7 days
};
```

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Session Lifecycle                        │
└─────────────────────────────────────────────────────────────┘

  Sign In                   Active Use                Sign Out
     │                          │                         │
     ▼                          ▼                         ▼
┌─────────┐              ┌─────────────┐            ┌─────────┐
│ Create  │              │ Validate &  │            │ Delete  │
│ session │──────────────│ refresh     │────────────│ session │
│ record  │              │ expiry      │            │ record  │
└─────────┘              └─────────────┘            └─────────┘
     │                          │                         │
     ▼                          ▼                         ▼
┌─────────┐              ┌─────────────┐            ┌─────────┐
│ Set     │              │ Update      │            │ Clear   │
│ cookie  │              │ last_access │            │ cookie  │
└─────────┘              └─────────────┘            └─────────┘
```

### Session Operations

```typescript
import { cookies } from 'next/headers';

interface Session {
  id: string;
  userId: string;
  currentOrgId: string | null;
  expiresAt: Date;
  lastAccessedAt: Date;
}

// Create a new session
async function createSession(userId: string, orgId?: string): Promise<Session> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session = await db.sessions.create({
    data: {
      userId,
      currentOrgId: orgId ?? null,
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set('session_id', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt
  });

  return session;
}

// Get current session
async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;

  if (!sessionId) return null;

  const session = await db.sessions.findUnique({
    where: { id: sessionId }
  });

  if (!session || session.expiresAt < new Date()) {
    // Session expired or not found
    await destroySession();
    return null;
  }

  // Update last accessed time (sliding expiration)
  await db.sessions.update({
    where: { id: sessionId },
    data: { lastAccessedAt: new Date() }
  });

  return session;
}

// Destroy session
async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;

  if (sessionId) {
    await db.sessions.delete({ where: { id: sessionId } }).catch(() => {});
  }

  cookieStore.delete('session_id');
}

// Switch organization context
async function switchOrganization(sessionId: string, orgId: string): Promise<void> {
  await db.sessions.update({
    where: { id: sessionId },
    data: { currentOrgId: orgId }
  });
}
```

## Authentication

### Sign Up Flow (Tenant Users Only)

Internal staff cannot self-register. This flow is for tenant users only.

```
┌─────────────────────────────────────────────────────────────┐
│                    Tenant User Sign Up                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Validate email format and password strength             │
│  2. Check if email already exists                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Hash password (bcrypt, cost factor 12)                  │
│  4. Create user record (is_admin = false)                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Create new organization                                 │
│  6. Add user as organization owner                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Create session record in database                       │
│  8. Set session_id cookie                                   │
│  9. Return success response                                 │
└─────────────────────────────────────────────────────────────┘
```

### Sign In Flow (All Users)

```
┌─────────────────────────────────────────────────────────────┐
│                        User Sign In                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Find user by email                                      │
│  2. Verify password against hash                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────┴───────┐
                    │  is_admin?    │
                    └───────┬───────┘
              ┌─────────────┼─────────────┐
              ▼             │             ▼
┌─────────────────────┐     │   ┌─────────────────────┐
│   Internal Staff    │     │   │    Tenant User      │
│ • No org context    │     │   │ • Load memberships  │
│ • current_org=null  │     │   │ • Set default org   │
└─────────────────────┘     │   └─────────────────────┘
              │             │             │
              └─────────────┼─────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Create session record in database                       │
│  4. Set session_id cookie                                   │
│  5. Return success response                                 │
└─────────────────────────────────────────────────────────────┘
```

### Sign Out Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Sign Out                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Read session_id from cookie                             │
│  2. Delete session record from database                     │
│  3. Clear session_id cookie                                 │
│  4. Return success response                                 │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### POST /api/auth/signup

Create a new tenant user account and organization.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "organizationName": "My Company"
}
```

**Response (201 Created):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "isAdmin": false
  },
  "organization": {
    "id": "uuid",
    "name": "My Company",
    "slug": "my-company"
  }
}
```

*Session cookie is set automatically via `Set-Cookie` header.*

**Errors:**

| Status | Code              | Description            |
| ------ | ----------------- | ---------------------- |
| 400    | INVALID_EMAIL     | Email format invalid   |
| 400    | WEAK_PASSWORD     | Password too weak      |
| 409    | EMAIL_EXISTS      | Email already in use   |

### POST /api/auth/signin

Authenticate any user (tenant or internal staff).

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK) - Tenant User:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "isAdmin": false
  },
  "organizations": [
    {
      "id": "uuid",
      "name": "My Company",
      "slug": "my-company",
      "role": "owner"
    }
  ]
}
```

**Response (200 OK) - Internal Staff:**

```json
{
  "user": {
    "id": "uuid",
    "email": "support@ourcompany.com",
    "isAdmin": true
  },
  "organizations": []
}
```

*Session cookie is set automatically via `Set-Cookie` header.*

**Errors:**

| Status | Code                | Description              |
| ------ | ------------------- | ------------------------ |
| 401    | INVALID_CREDENTIALS | Email or password wrong  |

### POST /api/auth/signout

End the current session.

**Response (200 OK):**

```json
{
  "success": true
}
```

*Session cookie is cleared via `Set-Cookie` header.*

### GET /api/auth/me

Get current authenticated user and session info.

**Response (200 OK):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "isAdmin": false
  },
  "currentOrganization": {
    "id": "uuid",
    "name": "My Company",
    "slug": "my-company",
    "role": "owner"
  }
}
```

**Errors:**

| Status | Code           | Description        |
| ------ | -------------- | ------------------ |
| 401    | UNAUTHENTICATED| No valid session   |

## Authorization

### Authorization Logic

```typescript
type AuthResult =
  | { authorized: true; reason: 'admin' | 'role' }
  | { authorized: false; reason: 'unauthenticated' | 'no_membership' | 'insufficient_role' };

async function authorize(
  organizationId: string,
  requiredRoles: Role[]
): Promise<AuthResult> {
  const session = await getSession();

  if (!session) {
    return { authorized: false, reason: 'unauthenticated' };
  }

  const user = await db.users.findUnique({ where: { id: session.userId } });

  if (!user) {
    return { authorized: false, reason: 'unauthenticated' };
  }

  // Internal staff bypass tenant RBAC
  if (user.isAdmin) {
    return { authorized: true, reason: 'admin' };
  }

  // Check tenant RBAC
  const membership = await db.organizationMembers.findFirst({
    where: {
      userId: session.userId,
      organizationId,
      role: { in: requiredRoles }
    }
  });

  if (!membership) {
    return { authorized: false, reason: 'no_membership' };
  }

  return { authorized: true, reason: 'role' };
}
```

### Authorization Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Authorization Check                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  Valid session?       │
                │  (cookie + db lookup) │
                └───────────┬───────────┘
                            │
              ┌─────────────┼─────────────┐
              │ No          │             │ Yes
              ▼             │             ▼
        ┌───────────┐       │   ┌───────────────────┐
        │ 401 Error │       │   │  user.isAdmin?    │
        └───────────┘       │   └─────────┬─────────┘
                            │             │
                            │   ┌─────────┼─────────┐
                            │   │ Yes     │         │ No
                            │   ▼         │         ▼
                            │ ┌───────┐   │   ┌───────────────┐
                            │ │ ALLOW │   │   │ Check org     │
                            │ └───────┘   │   │ membership +  │
                            │             │   │ role          │
                            │             │   └───────┬───────┘
                            │             │           │
                            │             │   ┌───────┼───────┐
                            │             │   │ Pass  │       │ Fail
                            │             │   ▼       │       ▼
                            │             │ ┌───────┐ │ ┌───────────┐
                            │             │ │ ALLOW │ │ │ 403 Error │
                            │             │ └───────┘ │ └───────────┘
                            └─────────────┴───────────┘
```

### Tenant Role Hierarchy

```
owner > admin > member
```

- `owner`: All permissions including delete org, manage billing
- `admin`: Manage members, all resource operations
- `member`: Read/write access to org resources

### Example Protected Route

```typescript
// GET /api/orgs/:orgId/resources
export async function GET(req: Request, { params }) {
  const auth = await authorize(params.orgId, ['owner', 'admin', 'member']);

  if (!auth.authorized) {
    const status = auth.reason === 'unauthenticated' ? 401 : 403;
    return Response.json({ error: auth.reason }, { status });
  }

  // Log if admin accessed tenant data
  if (auth.reason === 'admin') {
    const session = await getSession();
    await logAdminAccess(session!.userId, params.orgId, 'read_resources');
  }

  // Proceed with request...
}
```

### Middleware Example

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const sessionId = request.cookies.get('session_id')?.value;

  // Protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!sessionId) {
      return NextResponse.redirect(new URL('/signin', request.url));
    }
  }

  // Auth routes (redirect if already logged in)
  if (request.nextUrl.pathname.startsWith('/signin') ||
      request.nextUrl.pathname.startsWith('/signup')) {
    if (sessionId) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/signin', '/signup']
};
```

## Internal Staff Management

### Creating Internal Staff Users

Internal staff are NOT created via self-signup. They must be provisioned by existing admins.

```typescript
// Only callable by existing is_admin users
async function createInternalUser(
  email: string,
  password: string,
  createdBy: string
): Promise<User> {
  const hashedPassword = await hashPassword(password);

  const user = await db.users.create({
    data: {
      email,
      passwordHash: hashedPassword,
      isAdmin: true  // Flag that grants cross-tenant access
    }
  });

  await logAdminAction(createdBy, 'create_admin_user', { newUserId: user.id });

  return user;
}
```

### Admin Audit Logging

All internal staff actions on tenant data should be logged:

```typescript
interface AdminAuditLog {
  adminUserId: string;
  action: string;
  targetOrgId?: string;
  targetUserId?: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}
```

## Security Considerations

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Password Hashing

Use bcrypt with a cost factor of 12:

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### Session Security

- **httpOnly cookies**: Session ID not accessible via JavaScript
- **Secure flag**: Cookie only sent over HTTPS (in production)
- **SameSite=Lax**: Protection against CSRF attacks
- **Server-side storage**: Session data never exposed to client
- **Sliding expiration**: Session extended on activity
- **Explicit invalidation**: Session deleted on sign out

### Session Cleanup

Periodically clean up expired sessions:

```typescript
// Run via cron job or scheduled task
async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.sessions.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  });

  return result.count;
}
```

### Rate Limiting

Apply rate limiting to auth endpoints:

- Sign up: 5 requests per minute per IP
- Sign in: 10 requests per minute per IP
- Failed attempts: Lock account after 5 failed attempts

### Internal Staff Security

- Restrict `is_admin` flag modification to database-level or super-admin only
- Log all admin access to tenant data
- Consider IP allowlisting for admin access
- Regular audit of admin user list

## Implementation Checklist

### MVP (In Scope)

- [ ] User registration with email/password
- [ ] Automatic organization creation on signup
- [ ] Owner role assignment
- [ ] Session-based authentication
- [ ] Session storage in database
- [ ] Secure cookie configuration
- [ ] Tenant RBAC (owner, admin, member)
- [ ] Internal staff flag (`is_admin`)
- [ ] Admin bypass for tenant RBAC checks
- [ ] Protected route middleware
- [ ] Session cleanup job

### Future Enhancements (Out of Scope)

- [ ] Passkey authentication (WebAuthn)
- [ ] Password reset via email
- [ ] Email verification
- [ ] Email notification system
- [ ] Invite members to organization
- [ ] OAuth providers (Google, GitHub)
- [ ] Two-factor authentication (2FA)
- [ ] Audit logging
- [ ] Session management UI
- [ ] Admin user management UI

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/app"

# Session
SESSION_MAX_AGE="604800"  # 7 days in seconds

# Security
BCRYPT_SALT_ROUNDS="12"
```

## Directory Structure

```
app/
├── api/
│   └── auth/
│       ├── signup/
│       │   └── route.ts
│       ├── signin/
│       │   └── route.ts
│       ├── signout/
│       │   └── route.ts
│       └── me/
│           └── route.ts
├── (auth)/
│   ├── signin/
│   │   └── page.tsx
│   └── signup/
│       └── page.tsx
├── (dashboard)/              # Tenant user dashboard
│   └── [orgSlug]/
│       └── ...
└── (admin)/                  # Internal staff dashboard
    └── support/
        └── ...

lib/
├── auth/
│   ├── session.ts           # Session CRUD operations
│   ├── password.ts          # Hashing utilities
│   └── middleware.ts        # Auth middleware
└── db/
    └── schema.ts
```
