# Founder OS

Private operating system for taking digital products from problem to released and monetized product.

## Local setup

Requirements: Node.js 20.9+, pnpm 11+, and PostgreSQL 14+ for database-backed auth/migrations.

```bash
pnpm install
copy .env.example .env.local
# Set DATABASE_URL and a random BETTER_AUTH_SECRET in .env.local
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The app is intentionally usable without database credentials for public shell development. Auth and migrations require PostgreSQL plus the environment variables.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Architecture

The single Next.js application separates public, auth and private routes. Domain code belongs in `src/modules`; persistence is in `src/db`; shared server configuration is in `src/lib`. Visibility is enforced as a database default (`PRIVATE`) and must also be checked in server-side queries/actions.

See [docs/PRD.md](docs/PRD.md), [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md), and [docs/DECISIONS.md](docs/DECISIONS.md).
