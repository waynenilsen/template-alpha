# Codebase Structure

This document describes the directory structure and architecture of the project.

## Directory Overview

```
/
├── app/                  # Next.js App Router (pages, layouts, API routes)
├── components/           # React components
│   ├── ui/               # shadcn/ui primitives (don't modify directly)
│   └── *.tsx             # Custom components
├── hooks/                # Custom React hooks
├── lib/                  # Core utilities and services
│   ├── auth/             # Authentication & authorization
│   ├── email/            # Email service and templates
│   ├── test/             # Test harness and factories
│   └── *.ts              # Shared utilities (db.ts, utils.ts)
├── trpc/                 # tRPC server
│   ├── routers/          # Procedure routers (auth, todo, etc.)
│   └── *.ts              # Core setup (init, client, server)
├── prisma/               # Database schema (split by domain)
├── scripts/              # Build and setup scripts
├── docs/                 # Extended documentation
└── .storybook/           # Storybook configuration
```

## App Directory

Next.js App Router structure:

```
app/
├── layout.tsx            # Root layout (providers, global setup)
├── page.tsx              # Home page
├── globals.css           # Tailwind + CSS variables
├── api/
│   └── trpc/[trpc]/      # tRPC HTTP handler
└── (auth)/               # Auth route group
    ├── layout.tsx        # Shared auth layout
    ├── sign-in/
    ├── sign-up/
    └── forgot-password/
```

**Conventions:**
- Route groups `(name)/` share layouts without affecting URL
- Page components go in `page.tsx`
- Layouts wrap child routes via `layout.tsx`

## Components Directory

```
components/
├── ui/                   # shadcn/ui components (50+)
│   ├── button.tsx
│   ├── input.tsx
│   ├── form.tsx
│   └── ...
├── pages/                # Page-level components for Storybook
│   └── *.stories.tsx
└── *.tsx                 # Custom components
    ├── auth-layout.tsx
    ├── login-form.tsx
    ├── sign-up-form.tsx
    └── ...
```

**Conventions:**
- `ui/` contains shadcn components - regenerate, don't hand-edit
- Custom components go in root `components/`
- Storybook stories are co-located with components (`*.stories.tsx`)
- Page-level stories go in `pages/` subdirectory

## Lib Directory

Core utilities and services:

```
lib/
├── db.ts                 # Prisma client (singleton)
├── utils.ts              # General utilities (cn for classnames)
├── auth/
│   ├── password.ts       # Hashing with bcrypt
│   ├── session.ts        # Session CRUD, cookie management
│   └── authorization.ts  # RBAC (roles, permissions, checks)
├── email/
│   ├── send.ts           # Nodemailer transport
│   └── templates/        # React Email templates
│       └── welcome.tsx
└── test/
    └── harness.ts        # Test context, factories, cleanup
```

**Conventions:**
- One concern per file
- Barrel exports via `index.ts` in subdirectories
- Tests co-located as `*.test.ts`

## tRPC Directory

Server-side tRPC setup:

```
trpc/
├── init.ts               # Context, middleware, procedure types
├── router.ts             # Root router (merges all sub-routers)
├── client.tsx            # React client provider
├── server.tsx            # Server-side caller for RSC
├── query-client.ts       # TanStack Query config
└── routers/
    ├── auth.ts           # signUp, signIn, signOut, me
    ├── auth.test.ts
    ├── todo.ts           # CRUD, toggleComplete, stats
    └── todo.test.ts
```

**Middleware Pattern (tmid):**

All procedures use `publicProcedure` and compose middleware via `tmid()`:

```typescript
import { tmid } from "@/lib/trpc";
import { auth, orgContext, withPrisma } from "@/lib/trpc/middlewares";

// Public (no auth)
tmid().use(withPrisma()).build(...)

// Authenticated
tmid().use(withPrisma()).use(auth()).build(...)

// Org-scoped (auth + organization context)
tmid().use(withPrisma()).use(auth()).use(orgContext()).build(...)

// Admin-only
tmid().use(withPrisma()).use(auth()).use(adminOnly()).build(...)
```

**Adding a new router:**
1. Create `trpc/routers/myrouter.ts`
2. Define procedures using `publicProcedure` with tmid middleware
3. Import and merge in `trpc/router.ts`
4. Add tests in `trpc/routers/myrouter.test.ts`

## Prisma Directory

Schema split by domain:

```
prisma/
├── schema.prisma         # Generator & datasource config
├── user.prisma           # User model
├── organization.prisma   # Organization, OrganizationMember, MemberRole
├── session.prisma        # Session model
└── todo.prisma           # Todo model
```

**Models:**
- **User** - Authentication accounts
- **Organization** - Tenant workspaces
- **OrganizationMember** - Role assignments (owner/admin/member)
- **Session** - Database-backed sessions (7-day expiry)
- **Todo** - Organization-scoped tasks

**Conventions:**
- One model per file (except related models like Org + Member)
- All tenant resources include `organizationId`
- Cascade deletes configured for cleanup

## Scripts Directory

```
scripts/
└── setup-postgres.sh     # PostgreSQL setup (Docker or local)
```

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript (strict mode, path aliases) |
| `biome.json` | Linting and formatting |
| `components.json` | shadcn/ui configuration |
| `bunfig.toml` | Bun config (test coverage: 81%) |
| `next.config.ts` | Next.js configuration |
| `docker-compose.yml` | PostgreSQL container |
| `prisma.config.ts` | Prisma configuration |

## Key Patterns

### Multi-Tenant Architecture
- Shared database, shared schema
- All resources scoped via `organizationId`
- Row-level security enforced in application layer via tmid middlewares

### Authentication Flow
1. User signs in via `auth.signIn`
2. Session created in database, ID stored in cookie
3. `auth()` middleware validates session on each request
4. `orgContext()` middleware validates organization membership

### Testing Pattern
- Real PostgreSQL for all tests (never mock the database)
- Test harness provides factories and automatic cleanup
- Coverage threshold enforced in CI (81% minimum)

### Component Architecture
- shadcn/ui for primitives (buttons, inputs, dialogs)
- Custom components compose shadcn primitives
- Storybook for component development and documentation

## Adding New Features

### New Page
1. Create route in `app/` following App Router conventions
2. Add page component, use `"use client"` if interactive
3. Add Storybook story if complex

### New API Endpoint
1. Add procedure to existing router or create new router
2. Compose tmid middlewares (`withPrisma`, `auth`, `orgContext`, `adminOnly`)
3. Add comprehensive tests

### New Database Model
1. Create `prisma/modelname.prisma`
2. Add `organizationId` if tenant-scoped
3. Run `bun db:push` to sync
4. Add factory method in `lib/test/harness.ts`

### New UI Component
1. Check if shadcn has it: `bunx shadcn@latest add [name]`
2. If custom, create in `components/` (not `ui/`)
3. Add Storybook story
