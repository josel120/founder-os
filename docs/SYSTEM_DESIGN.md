# Founder OS — System Design

## Runtime

One Next.js application with React, TypeScript strict, Tailwind, Drizzle ORM and PostgreSQL. It is deployable to Vercel and keeps secrets server-side. Better Auth is mounted at `/api/auth/[...all]` and uses the Drizzle-backed auth tables.

## Boundaries

`src/app` owns routing and composition. `src/modules` owns domain behavior. `src/db` owns schema and migrations. `src/lib` owns cross-cutting server configuration. Public, auth and private route groups remain separate as features grow.

## Security

Database visibility defaults to `PRIVATE`. Future private queries/actions must scope ownership server-side before returning data. Public metadata must be explicitly selected from publishable fields. Zod is the boundary validator. No secrets are committed; `.env.example` contains placeholders only.

## Persistence

The initial schema includes Better Auth tables plus Problem, Idea, Project, DecisionLog and FinanceTransaction. Migrations are generated into `src/db/migrations` and applied with `pnpm db:migrate`. Seeds are intentionally empty until approved Phase 1 fixtures are available.
