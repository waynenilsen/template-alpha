# RBAC System Documentation

A home-rolled Role-Based Access Control (RBAC) system for multi-tenant applications.

## Overview

This MVP authentication and authorization system provides:

- User self-registration with automatic organization creation
- Multi-tenant architecture at its core
- Role-based access control (RBAC) by default
- Email/password authentication

## Core Concepts

### Multi-Tenancy

Every user belongs to an **Organization** (tenant). When a user signs up:

1. A new organization is created
2. The user is assigned as the **owner** of that organization
3. All subsequent resources are scoped to the organization

This ensures complete data isolation between tenants.

### RBAC Model

The system uses a simple role-based permission model:

```
User → Role → Permissions
  ↓
Organization (tenant)
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
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
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

### Roles Table (Optional, for custom roles)

```sql
CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  permissions     JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, name)
);
```

## Authentication

### Sign Up Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      User Sign Up                           │
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
│  4. Create user record                                      │
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

### Sign In Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      User Sign In                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Find user by email                                      │
│  2. Verify password against hash                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Load user's organization memberships                    │
│  4. Generate session/JWT token                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Return authenticated response with org context          │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### POST /api/auth/signup

Create a new user account and organization.

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
    "email": "user@example.com"
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

Authenticate an existing user.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
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

### Permission Checking

All protected routes should verify:

1. **Authentication** - Valid session/JWT token
2. **Organization context** - User belongs to the requested org
3. **Role-based access** - User's role permits the action

```typescript
// Middleware example
async function authorize(
  userId: string,
  organizationId: string,
  requiredRole: Role[]
): Promise<boolean> {
  const membership = await db.organizationMembers.findFirst({
    where: {
      userId,
      organizationId,
      role: { in: requiredRole }
    }
  });

  return !!membership;
}
```

### Role Hierarchy

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

  const hasAccess = await authorize(
    session.userId,
    params.orgId,
    ['owner', 'admin', 'member']
  );

  if (!hasAccess) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Proceed with request...
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
- Include organization context in token claims
- Implement token refresh mechanism

### Rate Limiting

Apply rate limiting to auth endpoints:

- Sign up: 5 requests per minute per IP
- Sign in: 10 requests per minute per IP
- Failed attempts: Lock account after 5 failed attempts

## Implementation Checklist

### MVP (In Scope)

- [x] User registration with email/password
- [x] Automatic organization creation on signup
- [x] Owner role assignment
- [x] User authentication (sign in)
- [x] Session management
- [x] Basic RBAC (owner, admin, member)
- [x] Protected route middleware

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
└── (dashboard)/
    └── [orgSlug]/
        └── ...

lib/
├── auth/
│   ├── session.ts
│   ├── password.ts
│   └── middleware.ts
└── db/
    └── schema.ts
```
