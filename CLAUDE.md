# CLAUDE.md

Project guidelines for AI assistants working on this codebase.

## Environment Setup (Do This First!)

**This project runs on Claude Code for Web, which starts each session with a fresh checkout.** Dependencies are not pre-installed.

Before doing anything else:

```bash
bun install        # Always run this first - dependencies won't be there
```

Don't assume the dev server is running or that anything is set up. Check first, install dependencies, then proceed.

## Project Overview

This is a **multi-tenant SaaS scaffold** using the Todo app as a demonstration kata. It's a work in progress—see README.md for implementation status.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 (dev server on port 58665)
- **Styling**: Tailwind CSS 4 + shadcn/ui (new-york style)
- **Database**: PostgreSQL via Docker Compose (port 54673)
- **Linting/Formatting**: Biome
- **Package Manager**: Bun

### Implemented
- **Prisma 7** (ORM) with PostgreSQL adapter
- **tRPC v11** with TanStack Query (new `queryOptions` pattern)

### Planned (not yet implemented)
- Home-rolled session auth
- Multi-tenant data isolation

## Commands

```bash
bun dev            # Start dev server (port 58665)
bun build          # Production build
bun test           # Run unit tests
bun test:coverage  # Run tests with coverage report
bun typecheck      # TypeScript type checking (CI uses this)
bun lint           # Run Biome checks (CI uses this)
bun lint:fix       # Fix lint issues (imports, rules)
bun format         # Format with Biome
docker compose up -d   # Start PostgreSQL
```

## Testing

**We strive for 100% test coverage.** All new code must include tests.

### Running Tests

**IMPORTANT: Always run tests with coverage to monitor impact:**

```bash
bun test:coverage  # Always use this - shows coverage report
```

When you run tests, **review the coverage output** at the bottom. Check:
1. Did your changes decrease overall coverage?
2. Are your new files showing up with good coverage?
3. What lines are uncovered? Add tests for them.

### Coverage Requirements

- **Current threshold: 81%** (configured in `bunfig.toml`)
- CI will fail if coverage drops below this threshold
- **Goal: 100% coverage** - always write tests that increase coverage
- When adding new code, you MUST add tests that cover it
- Never submit code that decreases coverage

### AI Assistants: Testing Workflow

When writing or modifying code:
1. Write the code changes
2. Write tests for the new/changed code
3. Run `bun test:coverage` and review the coverage table
4. If coverage decreased or new code is uncovered, add more tests
5. Repeat until coverage is maintained or improved

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

### Before Creating a PR

Always run the following before committing your final changes:

```bash
bun test:coverage && bun typecheck && bun lint:fix && bun format && git add .
```

**Important:** Run these commands in this order:
1. `bun test:coverage` - Run tests and verify coverage didn't drop
2. `bun typecheck` - Checks for TypeScript errors
3. `bun lint:fix` - Fixes lint issues and organizes imports
4. `bun format` - Applies code formatting

Skipping any of these steps may cause CI to fail.

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

### File Organization
- Pages go in `app/` using Next.js App Router conventions
- UI components from shadcn live in `components/ui/`
- Custom components go in `components/` (not in ui/)
- Hooks go in `hooks/`
- Utilities go in `lib/`

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
- Biome handles formatting—run `bun format` before committing
- Import organization is automatic via Biome

## Adding shadcn Components

Components are already installed. To add more:

```bash
bunx shadcn@latest add [component-name]
```

## Database

PostgreSQL connection for when Prisma is added:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:54673/template_alpha"
```

## Architecture Notes

### When implementing Prisma
- Schema should include: User, Organization, Membership, Todo
- Use soft deletes where appropriate
- All tenant-scoped models need an `organizationId` field

### tRPC Setup (implemented)
- Server code lives in `trpc/` directory
- Uses the **new TanStack Query integration** (v11), not the legacy hooks
- Client usage: `const trpc = useTRPC(); useQuery(trpc.procedure.queryOptions())`
- Server-side prefetching available via `trpc/server.tsx`
- Use Zod for input validation
- Add new procedures to `trpc/router.ts`

### When implementing Auth
- Session-based, not JWT
- Store sessions in database
- No third-party auth providers—keep it simple
