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

### Planned (not yet implemented)
- Prisma (ORM)
- tRPC (API layer)
- Home-rolled session auth
- Multi-tenant data isolation

## Commands

```bash
bun dev          # Start dev server (port 58665)
bun build        # Production build
bun lint         # Run Biome checks
bun format       # Format with Biome
docker compose up -d   # Start PostgreSQL
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
bun format && git add .
```

This ensures:
- Code is properly formatted with Biome
- All formatted changes are staged for commit

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

### When implementing tRPC
- Router goes in `server/trpc/`
- Use Zod for input validation
- Separate routers by domain (auth, todo, org)

### When implementing Auth
- Session-based, not JWT
- Store sessions in database
- No third-party auth providers—keep it simple
