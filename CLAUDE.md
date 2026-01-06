# CLAUDE.md

Project guidelines for AI assistants working on this codebase.

## Environment Setup (Do This First!)

**This project runs on Claude Code for Web, which starts each session with a fresh checkout.** Dependencies are not pre-installed.

Before doing anything else:

```bash
bun install        # Always run this first - dependencies won't be there
bun db:start       # Start PostgreSQL (works with or without Docker)
```

Don't assume the dev server is running or that anything is set up. Check first, install dependencies, then proceed.

**Note:** Claude Code for Web does not have Docker installed. The `bun db:start` script automatically detects this and installs/configures PostgreSQL locally instead.

## Project Overview

This is a **multi-tenant SaaS scaffold** using the Todo app as a demonstration kata. It's a work in progress—see README.md for implementation status.

**See [CODEBASE.md](./CODEBASE.md) for detailed directory structure and architecture.**

**See [SECURITY.md](./SECURITY.md) for authentication system documentation and AI agent guidelines.**

**See [docs/frontend.md](./docs/frontend.md) for frontend component architecture (hook + view + wrapper pattern).**

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 (dev server on port 58665)
- **Styling**: Tailwind CSS 4 + shadcn/ui (new-york style)
- **Database**: PostgreSQL (port 54673) - Docker or local install via `bun db:start`
- **Linting/Formatting**: Biome
- **Package Manager**: Bun

### Implemented
- **Prisma 7** (ORM) with PostgreSQL adapter
- **tRPC v11** with TanStack Query (new `queryOptions` pattern)
- **Session-based auth** with RBAC (owner/admin/member roles)
- **Multi-tenant data isolation** via organization-scoped procedures

### Planned (not yet implemented)
- Frontend auth flows (login/signup pages)

## Commands

```bash
bun run dev            # Start dev server (port 58665)
bun run build          # Production build
bun run test           # Run tests (clean environment + wipe + seed)
bun run test:coverage  # Run tests with coverage report
bun run test:fast      # Run tests without wipe (faster for debugging)
bun run test:env       # Set up test environment only (no tests)
bun run test:env:check # Check health of all test services
bun run typecheck      # TypeScript type checking (CI uses this)
bun run lint           # Run Biome checks (CI uses this)
bun run lint:fix       # Fix lint issues (imports, rules)
bun run format         # Format with Biome
bun run db:start       # Start PostgreSQL (auto-detects Docker vs local)
bun run mail:start     # Start mail server (auto-detects Docker vs local)
bun run stripe:mock    # Start Stripe mock server (auto-detects Docker vs local)
bun run stripe:sync    # Sync subscription plans to Stripe and database
bun run s3:start       # Start MinIO S3 storage (auto-detects Docker vs local)
```

**IMPORTANT:** Always use `bun run <script>` instead of `bun <script>` to ensure the test environment wrapper is used.

## Testing

**We strive for 100% test coverage.** All new code must include tests.

### Test Environment Wrapper (Recommended for AI Agents)

The test environment wrapper provides a **clean slate** for each test run. This is especially useful for AI agents and CI environments where test isolation is critical.

```bash
bun run test           # Full setup + wipe + seed + run tests (DEFAULT)
bun run test:coverage  # Same as above but with coverage report
bun run test:fast      # Skip wipe (faster for debugging)
bun run test:env       # Set up environment only (boot services, wipe, push schema, seed)
bun run test:env:check # Check health of all services
```

**What `bun run test` does:**
1. Boots PostgreSQL if not running
2. Wipes the database (drops public schema and recreates)
3. Pushes Prisma schema
4. Seeds required test data (subscription plans, etc.)
5. Boots MailHog if not running
6. Boots MinIO if not running
7. Wipes S3 buckets
8. Runs tests with coverage

**Options for `bun run test:env`:**
```bash
bun run test:env              # Full setup with wipe (default)
bun run test:env --no-wipe    # Skip wiping (faster for debugging)
bun run test:env --skip-mail  # Skip MailHog setup
bun run test:env --skip-s3    # Skip MinIO setup
bun run test:env --check      # Only check health, don't boot or wipe
```

**Programmatic API** (for advanced use in `scripts/test-env/index.ts`):
```typescript
import { testEnv } from "./scripts/test-env";

// Check health of all services
const health = await testEnv.checkHealth();

// Full setup
await testEnv.setup({ wipeDatabase: true, wipeS3: true });

// Individual operations
await testEnv.bootPostgres();
await testEnv.wipePostgres();
await testEnv.pushSchema();
await testEnv.seed();
```

### Running Tests

**CRITICAL: Always run tests with coverage BEFORE every commit:**

```bash
bun run test:coverage  # MUST run this before EVERY commit
```

When you run tests, **carefully review the coverage table** at the bottom of the output. Check:
1. Did your changes decrease overall coverage?
2. Are your new files showing up with good coverage?
3. What lines are uncovered? Add tests for them.
4. **Check EVERY file individually** - each must meet the 86% threshold!

### Coverage Requirements

- **Current threshold: 86%** (configured in `bunfig.toml`)
- **⚠️ THE THRESHOLD IS APPLIED AT THE FILE LEVEL, NOT OVERALL!** Each file must meet 86% individually.
- CI will fail if ANY file's coverage drops below the threshold
- **Goal: 100% coverage** - always write tests that increase coverage
- When adding new code, you MUST add tests that cover it
- Never submit code that decreases coverage
- Files that cannot be unit tested (client components requiring browser, Stripe integration, etc.) should be added to `coveragePathIgnorePatterns` in `bunfig.toml`

### AI Assistants: Testing Workflow

**CRITICAL: Always run `bun run test:coverage` BEFORE EVERY COMMIT - not just before PRs!**

When writing or modifying code:
1. Write the code changes
2. Write tests for the new/changed code
3. Run `bun run test:coverage` and **carefully review the coverage table**
4. **Check EACH FILE in the table individually** - if ANY file is below 86%, you MUST either:
   - Add more tests to increase coverage, OR
   - Add the file to `coveragePathIgnorePatterns` in `bunfig.toml` with a comment explaining why it cannot be tested
5. If a file cannot be unit tested (requires browser environment, external services, etc.), add it to `coveragePathIgnorePatterns` in `bunfig.toml` with a comment explaining why
6. **Repeat until ALL files meet the threshold** - do not commit until this passes!

### What Can and Cannot Be Mocked

**🚫 NEVER MOCK SERVICES WE HAVE LOCAL VERSIONS FOR - NO EXCEPTIONS!**

We have local services for testing - use them:
- **PostgreSQL**: Run `bun run db:start` - tests run against a real database
- **Email (MailHog)**: Run `bun run mail:start` - captures emails locally
- **Stripe (stripe-mock)**: Run `bun run stripe:mock` - local Stripe API
- **S3 (MinIO)**: Run `bun run s3:start` - local S3-compatible storage

**✅ You CAN mock:**
- Browser-specific APIs (window.location, localStorage, etc.)
- React hooks that require browser runtime (useState in "use client" components)
- Next.js runtime functions (cookies(), headers() from next/headers)

**Why no mocking of local services?**
- Tests catch real issues (constraints, API behavior, edge cases)
- No false confidence from mocked behavior
- Integration issues are caught early
- Mocking gives false security - your code might work with mocks but fail with the real service

### Writing Tests

- Test files go alongside source files with `.test.ts` extension
- Use Bun's built-in test runner (`bun:test`)
- Integration tests requiring database run in CI with PostgreSQL service

Example:
```typescript
import { describe, expect, test } from "bun:test";
import { myFunction } from "./myModule";

describe("myFunction", () => {
  test("does something expected", () => {
    expect(myFunction()).toBe(expectedValue);
  });
});
```

### Testing React Components with Hooks

For components that use hooks (tRPC, React Query, etc.), use `mock.module` BEFORE importing the component:

```typescript
import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

// Mock modules BEFORE importing the component
mock.module("@/trpc/client", () => ({
  useTRPC: () => ({
    // Mock the tRPC structure your component needs
  }),
}));

mock.module("@tanstack/react-query", () => ({
  useMutation: () => ({
    mutate: mock(() => {}),
    isPending: false,
    error: null,
  }),
}));

// Import component AFTER mocking
import { MyComponent } from "./my-component";

test("renders correctly", () => {
  const html = renderToString(createElement(MyComponent, { props }));
  expect(html).toContain("expected content");
});
```

**Key principles:**
- Mock external dependencies, not your own code
- For components with hooks, separate presentational logic into testable sub-components when possible
- Use `renderToString` for SSR testing of React components

## Frontend Development Workflow

**Always close the loop when doing frontend work.** Do not assume your changes work - verify them.

### Verification Process

1. **Use the browser MCP server** to interact with the running application
2. **Take screenshots** to visually verify your changes render correctly
3. **Check the browser console and terminal logs** for errors or warnings
4. **Iterate** until the feature works as expected - fix any issues you discover

### Type Checking

Run TypeScript type checking frequently as you work:

```bash
bunx tsc --noEmit
```

Do this:
- After making changes to TypeScript/TSX files
- Before considering a task complete
- When debugging type-related errors

### Before EVERY Commit

**Run the full verification suite before EVERY commit, not just before PRs:**

```bash
bun run test:coverage && bun run typecheck && bun run lint:fix && bun run format && git add .
```

**You MUST run these commands in this order:**
1. `bun run test:coverage` - **Run tests and CHECK THE COVERAGE TABLE** - every file must be ≥86%!
2. `bun run typecheck` - Checks for TypeScript errors
3. `bun run lint:fix` - Fixes lint issues and organizes imports
4. `bun run format` - Applies code formatting

**⚠️ DO NOT COMMIT if `bun run test:coverage` fails or shows any file below 86%!**

Skipping any of these steps WILL cause CI to fail. Running them locally saves CI minutes and avoids embarrassing failed builds.

## Git Workflow

**See [commit-message.md](./commit-message.md) for full commit message guidelines.**

This project uses Conventional Commits with an amend-and-force-push workflow:

```bash
# First commit
git add .
git commit -m "feat(scope): description"
git push -u origin <branch-name>

# Subsequent changes - amend instead of new commits
git add .
git commit --amend --no-edit
git push --force-with-lease
```

This keeps one clean commit per feature/fix instead of cluttering history with WIP commits.

## Code Conventions

### Styling
- Use Tailwind utility classes, not custom CSS
- shadcn/ui components are already installed—use them
- Follow the existing neutral color palette (see components.json)
- Use CSS variables for theming (defined in globals.css)

### TypeScript
- Strict mode is enabled
- Prefer explicit types over `any`
- Use Zod for runtime validation (already a dependency)

### Formatting
- 2-space indentation
- Biome handles formatting—run `bun run format` before committing
- Import organization is automatic via Biome

## Adding shadcn Components

Components are already installed. To add more:

```bash
bunx shadcn@latest add [component-name]
```

## Database

```bash
bun run db:start  # Start PostgreSQL
```

The `db:start` script handles PostgreSQL setup automatically:

| Environment | Behavior |
|-------------|----------|
| **Docker available** | Runs `docker compose up -d postgres` |
| **No Docker** (Claude Code Web) | Installs PostgreSQL locally, configures port 54673, creates database |
| **CI** (GitHub Actions) | Skips entirely—CI uses the `services` block for PostgreSQL |

Connection string (same in all environments):
```
DATABASE_URL="postgresql://postgres:postgres@localhost:54673/template_alpha"
```

## Mail Server

```bash
bun run mail:start  # Start mail server for development
```

The `mail:start` script handles mail server setup automatically:

| Environment | Behavior |
|-------------|----------|
| **Docker available** | Runs `docker compose up -d mailhog` |
| **No Docker** (Claude Code Web) | Downloads and runs MailHog binary locally |
| **CI** (GitHub Actions) | Skips entirely—emails are mocked in tests |

MailHog provides:
- **SMTP server**: `localhost:50239`
- **Web UI**: `http://localhost:58443` (view captured emails)

## Stripe Mock

```bash
bun run stripe:mock  # Start Stripe mock server for development
```

The `stripe:mock` script handles stripe-mock setup automatically:

| Environment | Behavior |
|-------------|----------|
| **Docker available** | Runs `docker compose up -d stripe-mock` |
| **No Docker** (Claude Code Web) | Downloads stripe-mock binary from GitHub releases, runs locally |
| **CI** (GitHub Actions) | Skips entirely—Stripe is mocked in tests |

stripe-mock provides a local Stripe API for development:
- **API endpoint**: `http://localhost:59310`

To sync plans with stripe-mock:
```bash
bun run stripe:mock   # Start stripe-mock first
bun run stripe:sync   # Sync plans to stripe-mock and database
```

Environment variables (already set in `.env.local`):
```
STRIPE_SECRET_KEY="sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
STRIPE_MOCK_URL="http://localhost:59310"
```

**Note:** stripe-mock requires a valid-looking test key format (e.g., `sk_test_...`).

## S3 Storage (MinIO)

```bash
bun run s3:start  # Start MinIO S3-compatible storage
```

The `s3:start` script handles MinIO setup automatically:

| Environment | Behavior |
|-------------|----------|
| **Docker available** | Runs `docker compose up -d minio` with bucket initialization |
| **No Docker** (Claude Code Web) | Downloads MinIO binary, runs locally, creates buckets |
| **CI** (GitHub Actions) | Skips entirely—S3 is mocked in tests |

MinIO provides S3-compatible storage for development:
- **S3 API endpoint**: `http://localhost:52871`
- **Console UI**: `http://localhost:52872`

Buckets (created automatically):
- `template-alpha-public` - For avatars and public assets
- `template-alpha-private` - For attachments and private files

Environment variables:
```
S3_ENDPOINT="http://localhost:52871"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET_PUBLIC="template-alpha-public"
S3_BUCKET_PRIVATE="template-alpha-private"
```

## Testing

Run tests with:

```bash
bun run test           # Run all tests (with clean environment)
bun run test <file>    # Run specific test file
```

### Testing Philosophy

**NEVER mock the database.** All tests run against a real PostgreSQL instance. This ensures:
- Tests catch real database issues (constraints, migrations, performance)
- No false confidence from mocked behavior
- Integration issues are caught early

### Test Harness

Use the test harness in `lib/test/harness.ts`:

```typescript
import { createTestContext, withTestContext } from "../lib/test/harness";

// Option 1: Manual cleanup
const ctx = createTestContext();
const user = await ctx.createUser();
const org = await ctx.createOrganization();
await ctx.cleanup(); // Always cleanup

// Option 2: Auto-cleanup wrapper
await withTestContext(async (ctx) => {
  const user = await ctx.createUser();
  // cleanup happens automatically
});
```

Available factories:
- `ctx.createUser(options?)` - Creates a user with hashed password
- `ctx.createOrganization(options?)` - Creates an organization
- `ctx.createMembership(options)` - Creates org membership
- `ctx.createSession(options)` - Creates a session
- `ctx.createTodo(options)` - Creates a todo
- `ctx.createUserWithOrg(options?)` - Creates user + org + membership
- `ctx.signIn(user, orgId?)` - Creates a session for user

### Testing tRPC Procedures

```typescript
import { createTestTRPCContext } from "../trpc/init";
import { appRouter } from "../trpc/router";

// Unauthenticated caller
const ctx = createTestTRPCContext({ prisma: testCtx.prisma });
const caller = appRouter.createCaller(ctx);

// Authenticated caller
const ctx = createTestTRPCContext({
  prisma: testCtx.prisma,
  sessionId: session.id,
  session,
  user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
});
const caller = appRouter.createCaller(ctx);
```

