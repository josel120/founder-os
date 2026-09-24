## Changes

Adds owner-scoped access for private Ideas and Problems, restricts account creation to controlled owner setup, and reports confirmed save results instead of silent success. Improves authentication/navigation UI and adds initial private Problems capture.

Database CLI now loads local environment files. CI covers lint, types, unit tests, production build and browser tests. A sandbox test launcher provides reproducible Windows execution.

## Validation

- ESLint passed.
- TypeScript passed.
- 38 unit/component tests passed.
- Production build passed.
- 5 Playwright tests passed against production server (public/auth UI and anonymous access).

## Deployment prerequisites and remaining scope

Set OWNER_EMAIL to the existing account. Migration 0001 only adds nullable owner columns and foreign keys; it does not delete or assign historical data. Review ADR-006 and explicitly adopt existing records before expecting them to appear. Migration has not been applied to the live local database.

Authenticated database E2E, Problem-to-Idea and Decision Log remain pending. Phase 0/1 are not declared complete. Registration UI requires follow-up to reflect closed owner setup.
