# Founder OS agent guide

- Respect the modular architecture and domain boundaries under `src/modules`.
- Keep TypeScript strict and do not use `any` without exceptional, documented justification.
- Keep important domain logic out of React components; use actions, queries, schemas and services.
- Never expose `PRIVATE` information through public routes, metadata, logs or client payloads.
- Enforce authorization server-side and validate external inputs with Zod.
- Do not add dependencies without a clear justification; do not create duplicate APIs or services.
- Never rewrite old migrations casually. Add a new migration for schema changes.
- Add or update tests whenever behavior changes; run lint, typecheck and tests before declaring work complete.
- Document important architectural decisions in `docs/DECISIONS.md`.
