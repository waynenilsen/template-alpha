# RBAC System Documentation

A home-rolled Role-Based Access Control (RBAC) system for multi-tenant applications with internal staff support.

## Overview

This MVP authentication and authorization system provides:

- User self-registration with automatic organization creation
- Multi-tenant architecture at its core
- Role-based access control (RBAC) for tenant users
- Internal staff access via simple admin flag (customer support)
- Email/password authentication

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
│  7. Generate session/JWT token                              │
│  8. Return authenticated response                           │
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
│   • No org context  │     │   │ • Load memberships  │
│   • Admin dashboard │     │   │ • Set default org   │
└─────────────────────┘     │   └─────────────────────┘
              │             │             │
              └─────────────┼─────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Generate session/JWT token                              │
│  4. Return authenticated response                           │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### POST /api/auth/signup

Create a new tenant user account and organization. Internal staff cannot use this endpoint.

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
  },
  "token": "jwt-token"
}
```

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
  ],
  "token": "jwt-token"
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
  "organizations": [],
  "token": "jwt-token"
}
```

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

## Authorization

### Authorization Logic

```typescript
type AuthResult =
  | { authorized: true; reason: 'admin' | 'role' }
  | { authorized: false; reason: 'unauthenticated' | 'no_membership' | 'insufficient_role' };

async function authorize(
  userId: string,
  organizationId: string,
  requiredRoles: Role[]
): Promise<AuthResult> {
  const user = await db.users.findUnique({ where: { id: userId } });

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
      userId,
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
                │  Valid session/JWT?   │
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
  const session = await getSession(req);

  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const auth = await authorize(
    session.userId,
    params.orgId,
    ['owner', 'admin', 'member']
  );

  if (!auth.authorized) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Log if admin accessed tenant data
  if (auth.reason === 'admin') {
    await logAdminAccess(session.userId, params.orgId, 'read_resources');
  }

  // Proceed with request...
}
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

### Session/JWT Tokens

- Use secure, httpOnly cookies for web sessions
- JWT tokens should have short expiration (15 min - 1 hour)
- Include `isAdmin` flag in token claims
- Include organization context for tenant users
- Implement token refresh mechanism

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
- [ ] User authentication (sign in)
- [ ] Session management
- [ ] Tenant RBAC (owner, admin, member)
- [ ] Internal staff flag (`is_admin`)
- [ ] Admin bypass for tenant RBAC checks
- [ ] Protected route middleware

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

# Auth
JWT_SECRET="your-secure-secret-key"
JWT_EXPIRES_IN="1h"

# Session
SESSION_SECRET="your-session-secret"
SESSION_MAX_AGE="86400" # 24 hours

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
│       └── signout/
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
│   ├── session.ts
│   ├── password.ts
│   └── middleware.ts
└── db/
    └── schema.ts
```
