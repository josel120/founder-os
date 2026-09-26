# Founder OS — Production Runbook (ADR-016)

One document to deploy, migrate, roll back and restore the production app. Sections 1–3 and 5–8
change production or touch a secret and are run by the **human owner only** — never by an agent,
and never pasted into an agent session. Sections 4, 9 and 10 are reference and read-only checks;
an agent may read or run those.

**Conventions**
- Run every command from a bash/zsh shell on your own machine, logged into `vercel` (and `neonctl`
  if you use it), from the repo root.
- Replace every `<PLACEHOLDER>`. No command below contains a secret value; where one is needed you
  are told to type or paste it at a prompt so it never lands in shell history or in this file.
- `neonctl`/`vercel` CLI flags are current as of writing. If a flag errors, run it with `--help` or
  use the linked web console step instead — both are given for the less stable commands.
- Direct vs. pooled Neon URL: every Neon branch has two connection strings. The **pooled** one
  (host contains `-pooler.`) is what the running app uses (`DATABASE_URL` in Vercel). The **direct**
  (unpooled) one is for `pnpm db:migrate` and any `psql`/`pg_dump` session — Drizzle's migrator needs
  a session-level connection, not a transaction-pooled one.

## 1. Provision Neon (human)

```bash
npx neonctl auth                                                   # one-time browser login
npx neonctl projects create --name founder-os --region-id <NEON_REGION>
# note the printed project id as <NEON_PROJECT_ID>; the project comes with a default branch
npx neonctl branches list --project-id <NEON_PROJECT_ID>   # its name is <DEFAULT_BRANCH> (e.g. production or main)
npx neonctl connection-string <DEFAULT_BRANCH> --project-id <NEON_PROJECT_ID> --pooled   # -> DATABASE_URL
npx neonctl connection-string <DEFAULT_BRANCH> --project-id <NEON_PROJECT_ID>            # -> direct URL, migrations only
```

Or via the console: New Project (choose the region) → note the project id → Branches → open the
default branch → Connection Details → copy both strings, toggling "Pooled connection". Later
sections call this branch `production`; use its real name.

## 2. Link Vercel to the repo (human)

```bash
npx vercel login
npx vercel link          # from the repo root; create a new project named founder-os
```

Or via the console: vercel.com/new → Import Git Repository → `josel120/founder-os`.

## 3. Set environment variables and deploy (human)

The repo pins pnpm 12 in `package.json` (`packageManager`). Vercel only uses that version when corepack is on;
otherwise its own pnpm refuses the install or skips build scripts, and the deploy fails in under a minute.

```bash
npx vercel env add ENABLE_EXPERIMENTAL_COREPACK production   # value: 1
npx vercel env add ENABLE_EXPERIMENTAL_COREPACK preview      # value: 1
npx vercel env add DATABASE_URL production            # paste the Neon POOLED production string
npx vercel env add BETTER_AUTH_SECRET production       # paste output of: openssl rand -base64 32
npx vercel env add BETTER_AUTH_URL production           # https://<PRODUCTION_DOMAIN>
npx vercel env add NEXT_PUBLIC_BETTER_AUTH_URL production  # same value as BETTER_AUTH_URL
npx vercel env add OWNER_EMAIL production               # the one account allowed to sign in

# Preview environment needs the same four to boot at all; a separate Neon branch is recommended
npx vercel env add DATABASE_URL preview
npx vercel env add BETTER_AUTH_SECRET preview
npx vercel env add BETTER_AUTH_URL preview               # the preview deployment's own URL
npx vercel env add NEXT_PUBLIC_BETTER_AUTH_URL preview
npx vercel env add OWNER_EMAIL preview

git push origin master        # Vercel's Git integration deploys Production
# or, without the Git integration:
npx vercel --prod

npx vercel ls                              # confirm the deployment is Ready
npx vercel inspect <DEPLOYMENT_URL> --logs # build/runtime logs if it isn't
```

Do not set `OWNER_SETUP_TOKEN` yet — see Section 5.

## 4. Environment variables (reference — no values)

| Variable | Purpose | Set in | Required in production |
|---|---|---|---|
| `DATABASE_URL` | Connection string the running app uses | Vercel project env (Production + Preview) | Yes |
| `DATABASE_POOLED` | Forces pooled-client tuning (`prepare: false`, small `max`) when the URL host doesn't contain `-pooler.` | Vercel project env, only if not using a Neon pooled hostname | No |
| `BETTER_AUTH_SECRET` | Signs and encrypts session tokens | Vercel project env | Yes |
| `BETTER_AUTH_URL` | Public origin Better Auth issues cookies/callbacks for; must be `https://` in production | Vercel project env | Yes |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Same origin, exposed to the browser client | Vercel project env | Yes |
| `OWNER_EMAIL` | The one account allowed to hold private data (ADR-005) | Vercel project env | Yes |
| `OWNER_SETUP_TOKEN` | One-time privileged header value that unlocks the sign-up endpoint for the owner only | Vercel project env, set temporarily (Section 5) then removed | No — must be absent outside first-owner setup |
| `ENABLE_EXPERIMENTAL_COREPACK` | Makes Vercel install the pnpm version pinned in `package.json` (value `1`) | Vercel project env (Production + Preview) | Yes (build) |
| `NODE_ENV` | Standard Next.js environment flag | Set by the Vercel platform | N/A (platform-set) |
| `VERCEL` | Marks the runtime as Vercel; strict env checks apply when it's `1` | Set by the Vercel platform | N/A (platform-set) |
| `FOUNDER_OS_STRICT_ENV` | Forces the same strict startup checks outside Vercel | Only if self-hosting elsewhere | No |

## 5. First-owner setup (human)

**Prerequisite: the schema exists.** A fresh Neon database has no tables, and every auth request
(sign-up included) reads them, `rate_limit` too. Run 6.2 against the direct URL first (an empty
database needs no backup), then continue here.

Run 5.2 immediately after 5.1: anyone who can reach the deployment and knows the token can create
the one owner account before you do (ADR-005).

```bash
# 5.1 — set a temporary token and redeploy
npx vercel env add OWNER_SETUP_TOKEN production   # paste output of: openssl rand -base64 32
npx vercel --prod

# 5.2 — create the owner account (hidden prompts; nothing is echoed or kept in shell history)
read -rs OWNER_SETUP_TOKEN; echo   # paste the same value just set in Vercel
read -rs OWNER_PASSWORD; echo      # the owner's chosen password
curl -sS -X POST "https://<PRODUCTION_DOMAIN>/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -H "x-founder-setup-token: $OWNER_SETUP_TOKEN" \
  -d "{\"email\":\"<OWNER_EMAIL>\",\"password\":\"$OWNER_PASSWORD\",\"name\":\"<OWNER_NAME>\"}"
unset OWNER_SETUP_TOKEN OWNER_PASSWORD
# 200 = account created. 403 = OWNER_EMAIL or the header didn't match (ADR-005) — recheck both.

# 5.3 — remove the token and redeploy, right away
npx vercel env rm OWNER_SETUP_TOKEN production
npx vercel --prod
```

## 6. Migration procedure (human)

**Order: migrate first, then deploy the code that needs it.** Code from T-053 on reads `rate_limit`
on every `/api/auth/*` request, so until migration 0007 is applied every sign-in fails with a 500.

**6.1 Back up** — pick one:

```bash
# Option A: Neon branch (fast rollback, no local file)
npx neonctl branches create --project-id <NEON_PROJECT_ID> \
  --name "pre-migration-$(date +%Y%m%d-%H%M)" --parent production

# Option B: pg_dump (portable; also required for the restore drill, Section 7)
mkdir -p work/backups
pg_dump "<NEON_DIRECT_URL>" --format=custom \
  --file="work/backups/founder-os-$(date +%Y%m%d-%H%M).dump"
```

**6.2 Apply**, against the **direct** URL:

```bash
DATABASE_URL="<NEON_DIRECT_URL>" pnpm db:migrate
echo "exit code: $?"   # non-zero = stop here, do not touch OWNER_EMAIL or redeploy the app
```

**6.3 Verify**, against the direct URL:

```bash
psql "<NEON_DIRECT_URL>" -c "\d evidence"
psql "<NEON_DIRECT_URL>" -c "\d rate_limit"
psql "<NEON_DIRECT_URL>" -c "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
```

Then run the smoke check (Section 10) against the live app.

**6.4 Adopt historical rows** — only if the inventory in `docs/DECISIONS.md#adr-006` shows unclaimed
`problem`/`idea`/`decision_log` rows. Follow that section's reviewed adoption procedure exactly:
read-only inventory first, then the explicit `UPDATE … WHERE id IN (…) RETURNING` statements inside
one transaction, verify the returned ids/counts and the linked Problem/Idea owner check, and only
`COMMIT` once they match. Never run an unrestricted `UPDATE`. Keep a private audit of the ids and
result.

**6.5 Roll back** — if 6.2 or 6.3 fails:

```bash
# If backed up via Neon branch: Neon Console -> Branches -> production -> Restore ->
# choose the pre-migration-<timestamp> branch (or "point in time" just before the migration).

# If backed up via pg_dump:
pg_restore --clean --if-exists --no-owner --dbname="<NEON_DIRECT_URL>" \
  "work/backups/founder-os-<TIMESTAMP>.dump"
```

Re-run 6.3 after either path.

## 7. Backup and restore drill (human)

Do this once before go-live, and after any large schema change.

```bash
# 1. Fresh backup of production
pg_dump "<NEON_DIRECT_URL>" --format=custom \
  --file="work/backups/founder-os-drill-$(date +%Y%m%d).dump"

# 2. A scratch target, isolated from production
npx neonctl branches create --project-id <NEON_PROJECT_ID> --name "restore-drill-$(date +%Y%m%d)"
npx neonctl connection-string "restore-drill-$(date +%Y%m%d)" --project-id <NEON_PROJECT_ID>

# 3. Restore into it
pg_restore --clean --if-exists --no-owner --dbname="<SCRATCH_DIRECT_URL>" \
  "work/backups/founder-os-drill-$(date +%Y%m%d).dump"

# 4. Verify (Section 6.3 queries, plus row counts)
psql "<SCRATCH_DIRECT_URL>" -c "SELECT count(*) FROM problem;"
psql "<SCRATCH_DIRECT_URL>" -c "SELECT count(*) FROM idea;"

# 5. Tear down
npx neonctl branches delete "restore-drill-$(date +%Y%m%d)" --project-id <NEON_PROJECT_ID>
```

Record each drill below.

**Drill log**

| Date | Dump size | Restored to | Verified by | Result |
|---|---|---|---|---|
| | | | | |

## 8. Secret rotation (human)

**`BETTER_AUTH_SECRET`** signs every session token. Rotating it invalidates every active session —
the owner (and no one else has a session) is signed out and must sign in again. It does not touch
stored password hashes or any data.

```bash
npx vercel env rm BETTER_AUTH_SECRET production
npx vercel env add BETTER_AUTH_SECRET production   # paste output of: openssl rand -base64 32
npx vercel --prod
```
Then sign in again at `https://<PRODUCTION_DOMAIN>/login`.

**`DATABASE_URL`** (e.g. a Neon role password reset): update the pooled string, redeploy, then load
any private page to confirm connectivity before considering it done.

**`OWNER_SETUP_TOKEN`**: only ever set for the duration of Section 5. If one leaks or is set outside
that window, remove it and redeploy immediately (`npx vercel env rm OWNER_SETUP_TOKEN production &&
npx vercel --prod`).

## 9. Incident checklist

**Auth errors (403 `FORBIDDEN` from Better Auth)**
- Expected for any account that isn't `OWNER_EMAIL`, or a setup-token call with a wrong header —
  ADR-005 working as intended, not a bug.
- Owner locked out: confirm `OWNER_EMAIL` in Vercel matches the account's email exactly (trimmed,
  lower-cased); confirm `BETTER_AUTH_URL`/`NEXT_PUBLIC_BETTER_AUTH_URL` equal the exact origin being
  browsed (a mismatch breaks cookies silently); confirm the app actually redeployed after any env
  var change — Vercel does not hot-reload them.

**429 on `/api/auth/sign-in/email`**
- Expected after 5 sign-in requests (any outcome) from one IP within 60 seconds (ADR-016/T-053). Wait
  for the `X-Retry-After` seconds and retry.
- The IP comes from `x-forwarded-for`. Vercel overwrites that header with the real client IP; a
  self-hosted deployment without a proxy that does the same lets a client bypass the limit.
- Do not disable rate limiting to work around a legitimate lockout; a shared/proxied owner IP is a
  known open tradeoff (ADR-016).

**`rate_limit` retention (ADR-016/T-059)**
- Each row's key is a client IP + path, kept only until 24h after its `last_request` — far longer
  than the longest window (60s, the sign-in rule), so an active limit is never affected.
- Pruning is opportunistic: a `DELETE … WHERE last_request < now() - 24h` runs after any auth
  request (sign-in attempts and the session check on every private page), throttled to at most once
  per hour per server instance. It never blocks or fails the request; a failed delete is only logged
  (`reportError("auth.rateLimitRetention", …)`).
- Check it: `psql "<NEON_DIRECT_URL>" -c "SELECT count(*), to_timestamp(min(last_request) / 1000) FROM rate_limit;"`.
  The oldest row should be at most ~25h old (24h retention plus up to an hour of throttle) whenever
  the app has had any auth traffic in the last hour.

**Database connection limit / "too many connections"**
- Confirm `DATABASE_URL` in Vercel is the **pooled** Neon string (`-pooler.` in the host) — serverless
  functions each open a connection, and the direct URL has far fewer slots.
- Neon Console → Monitoring → connections, for the branch.
- Confirm no one ran `pnpm db:migrate` against the pooled URL (migrations should target the direct
  URL, and use `max: 1`).

**Reading logs**
- `npx vercel logs <DEPLOYMENT_URL>` (needs the owner's Vercel session).
- Server errors are logged by `reportError()` (`src/lib/report-error.ts`) as one JSON line with only
  `scope`, `error` (the exception class name), `code` (Postgres SQLSTATE, if any) and `digest` (the
  Next.js error id) — never a message, SQL or form values. To correlate a user-visible failure, take
  the digest shown on the error screen and grep for it in the logs.
- CI failures are separate: `gh run view <RUN_ID> --log-failed 2>&1 | tail -80`, or hand the run id
  to the `ci-triager` subagent instead of reading full logs.

## 10. Post-deploy smoke check

Read-only HTTP checks; no secret is needed to run this.

```bash
BASE_URL="https://<PRODUCTION_DOMAIN>"

echo "-- security headers (HSTS, frame, nosniff, referrer, permissions, CSP with a nonce) --"
curl -sSI "$BASE_URL/login" | grep -Ei "^(strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|content-security-policy):"

echo "-- noindex on auth/private/api routes --"
curl -sSI "$BASE_URL/login"            | grep -i "^x-robots-tag:"
curl -sSI "$BASE_URL/private"          | grep -i "^x-robots-tag:"
curl -sSI "$BASE_URL/api/auth/session" | grep -i "^x-robots-tag:"

echo "-- anonymous /private redirects to /login?next=... (expect 307 + a matching location) --"
curl -sSI "$BASE_URL/private" | grep -iE "^(HTTP/|location:)"

echo "-- registration stays closed --"
curl -sS "$BASE_URL/register" | grep -o "Registration is closed"
```

All five checks should print a match. No match on the headers or noindex checks means the deploy
didn't pick up `next.config.ts`/`src/middleware.ts`; no redirect on `/private` is a stop-ship issue
(ADR-014).
