# Template Alpha

A scaffold template for building multi-tenant SaaS applications. Uses a simple Todo app as the kata for demonstrating the architecture patterns.

## Tech Stack

| Technology | Status | Notes |
|------------|--------|-------|
| Next.js 16 | ✅ Done | App Router, React 19 |
| Tailwind CSS 4 | ✅ Done | With CSS variables |
| shadcn/ui | ✅ Done | New York style, all components |
| Biome | ✅ Done | Linting + formatting |
| PostgreSQL | ✅ Done | Docker Compose or local install |
| TypeScript | ✅ Done | Strict mode |
| Prisma 7 | ✅ Done | ORM + migrations |
| tRPC v11 | ✅ Done | Type-safe API with TanStack Query |
| Auth | ✅ Done | Session-based with RBAC |
| Multi-tenancy | ✅ Done | Org-based data isolation |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (package manager)
- [Docker](https://www.docker.com/) (optional - for PostgreSQL)

### Setup

```bash
# Install dependencies
bun install

# Start the database (works with or without Docker)
bun db:start

# Run development server
bun dev
```

Open [http://localhost:58665](http://localhost:58665) to see the app.

### Database

PostgreSQL runs on port `54673` to avoid conflicts with local installations.

```
Host: localhost
Port: 54673
User: postgres
Password: postgres
Database: template_alpha
```

## Project Structure

```
├── app/                  # Next.js App Router pages
│   ├── (auth)/          # Auth pages (sign-in, sign-up, forgot-password, reset-password)
│   ├── settings/        # Settings pages (organization management)
│   ├── invite/          # Invitation acceptance flow
│   └── api/trpc/        # tRPC API route
├── components/
│   └── ui/              # shadcn/ui components
├── hooks/               # React hooks
├── lib/
│   ├── auth/            # Authentication logic (sessions, passwords, RBAC)
│   ├── email/           # Email sending utilities
│   └── test/            # Test harness and factories
├── trpc/
│   └── routers/         # tRPC routers (auth, organization, todo)
├── prisma/              # Database schema (split by domain)
├── docker-compose.yml   # PostgreSQL + MailHog containers
├── biome.json           # Linting/formatting config
└── components.json      # shadcn/ui config
```

## Scripts

```bash
bun dev            # Start dev server (port 58665)
bun build          # Production build
bun start          # Start production server
bun test           # Run unit tests
bun test:coverage  # Run tests with coverage report
bun typecheck      # TypeScript type checking
bun lint           # Run Biome linter
bun lint:fix       # Fix lint issues
bun format         # Format code with Biome
bun db:start       # Start PostgreSQL (auto-detects Docker vs local)
bun mail:start     # Start mail server for development
```

## Features

### Authentication
- Session-based authentication (no third-party dependencies)
- Sign in / Sign up pages with form validation
- Password reset flow with email verification
- Password strength indicator

### Multi-tenancy
- Organization-based data isolation
- Role-based access control (owner / admin / member)
- Team member invitations via email
- Organization switching
- Transfer ownership

### Todo Application (Demo)
- Full CRUD operations
- Completion toggling
- Stats dashboard (total, completed, pending, progress)
- Role-based delete permissions (admin+ only)

### API Layer
- Type-safe tRPC v11 procedures
- TanStack Query integration with `queryOptions` pattern
- Zod validation for all inputs
- Organization-scoped procedures for data isolation

### Future Enhancements
- [ ] Social OAuth (Google, GitHub) - UI placeholders exist
- [ ] Email verification on signup
- [ ] Organization settings editing
