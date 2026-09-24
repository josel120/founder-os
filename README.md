# Founder OS

For Windows sandbox environments where Vitest cannot bundle its config or write
to the system temporary directory, run:

```powershell
node scripts/test-sandbox.mjs
```

This uses Vitest's runner config loader and project-local temporary files.
It restores the shell environment and propagates the test exit code.

Private operating system for taking digital products from problem to released and monetized product.

## Local setup

Requirements: Node.js 22+ (24 used in CI), the pnpm version pinned in package.json, and PostgreSQL 14+ for database-backed auth/migrations.

```bash
pnpm install
copy .env.example .env.local
# Set DATABASE_URL and a random BETTER_AUTH_SECRET in .env.local
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The app is intentionally usable without database credentials for public shell development. Auth and migrations require PostgreSQL plus the environment variables.

Database CLI commands load .env.local followed by .env; existing environment
variables take precedence. Do not copy .env.example over an existing .env.local.
Generate migrations only after schema changes; new checkouts apply the committed
migrations with pnpm db:migrate. Review migration prerequisites before applying.
pnpm db:seed currently reports that no approved dataset is configured and changes
no data.

## Owner-only access and existing installations

Set OWNER_EMAIL in .env.local to the exact email of your existing account.
Leave OWNER_SETUP_TOKEN unset for an existing account. Missing OWNER_EMAIL denies
private access; registration is closed by default. First-owner setup is documented
in docs/DECISIONS.md (ADR-005).

The ownership migration adds owner_id without deleting or automatically assigning
historical records. Existing ideas/problems will remain hidden until their owner
is explicitly assigned using the reviewed procedure in ADR-006. Back up the
database and review that procedure before applying this migration to an existing
installation. This is required before using the updated private screens.

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
