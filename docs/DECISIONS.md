# Architecture decisions

## ADR-001: One Next.js application

Phase 0 uses one deployable Next.js repository. Domain modules provide boundaries without the operational cost of microservices.

## ADR-002: PostgreSQL and Drizzle

PostgreSQL is the system of record. Drizzle keeps schema and migrations close to TypeScript while preserving explicit SQL database behavior.

## ADR-003: Visibility is persisted

Visibility is a database enum with `PRIVATE` defaults, not merely a UI convention. Public exposure requires explicit publish behavior in a later phase.

## ADR-004: AI provider abstraction

`AIService` is an interface in the AI module. Provider credentials and implementation are intentionally absent from Phase 0.
