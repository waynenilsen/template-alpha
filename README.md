# Template Alpha

A scaffold template for building multi-tenant SaaS applications. Uses a simple Todo app as the kata for demonstrating the architecture patterns.

> **⚠️ Work in Progress** - This is an evolving template. See the implementation status below.

## Tech Stack

| Technology | Status | Notes |
|------------|--------|-------|
| Next.js 16 | ✅ Done | App Router, React 19 |
| Tailwind CSS 4 | ✅ Done | With CSS variables |
| shadcn/ui | ✅ Done | New York style, all components |
| Biome | ✅ Done | Linting + formatting |
| PostgreSQL | ✅ Done | Docker Compose for local dev |
| TypeScript | ✅ Done | Strict mode |
| Prisma | ❌ TODO | ORM + migrations |
| tRPC | ❌ TODO | Type-safe API layer |
| Auth | ❌ TODO | Home-rolled session auth |
| Multi-tenancy | ❌ TODO | Org-based data isolation |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (package manager)
- [Docker](https://www.docker.com/) (for PostgreSQL)

### Setup

```bash
# Start the database
docker compose up -d

# Install dependencies
bun install

# Run development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

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
├── components/
│   └── ui/              # shadcn/ui components
├── hooks/               # React hooks
├── lib/                 # Utilities
├── docker-compose.yml   # PostgreSQL container
├── biome.json          # Linting/formatting config
└── components.json     # shadcn/ui config
```

## Scripts

```bash
bun dev       # Start dev server
bun build     # Production build
bun start     # Start production server
bun lint      # Run Biome linter
bun format    # Format code with Biome
```

## Roadmap

### Phase 1: Data Layer
- [ ] Add Prisma with schema for Users, Orgs, Todos
- [ ] Set up migrations workflow
- [ ] Seed script for development

### Phase 2: API Layer
- [ ] Add tRPC router
- [ ] CRUD procedures for Todos
- [ ] Input validation with Zod

### Phase 3: Authentication
- [ ] Session-based auth (no third-party deps)
- [ ] Login/register pages
- [ ] Auth middleware

### Phase 4: Multi-tenancy
- [ ] Organization model
- [ ] Invite system
- [ ] Data isolation by org

### Phase 5: Todo Feature
- [ ] Todo list UI
- [ ] Create/update/delete/complete
- [ ] Filtering and search
