# service-status-page

A status page that health-checks registered websites and automatically locks down a domain in Cloudflare when it starts failing. Port of [Status Guard](https://github.com/ThunLights/Status-Guard) onto Hono + Inertia.js + Vue3 on Cloudflare Workers.

- Checks every registered website on a schedule and records the result
- Shows a 90-day uptime history per site at `/`
- When a domain keeps failing, enables its `auto:`-prefixed Cloudflare WAF custom rules; disables them again once the domain recovers

**Stack**

- ORM: [Drizzle ORM](https://orm.drizzle.team/) (`postgres-js` driver)
- Database: Postgres. In production this is [Neon](https://neon.tech/) accessed through [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) — Hyperdrive hides the actual provider, so the app code just talks to plain Postgres
- Scheduling: [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) (the Worker's `scheduled` handler — no external scheduler like trigger.dev)

## Quick start

```txt
bun install
docker compose up -d
cp .env.example .env
bun run db:migrate
bun run dev
```

`wrangler.jsonc`'s `hyperdrive[0].localConnectionString` points at the Postgres container from `docker-compose.yml`, so `bun run dev` gets a working database out of the box — both the SSR page and the `scheduled` handler can be exercised locally.

## Configuring monitoring

There is no admin UI; rows are inserted directly into the database.

| Table                | Purpose                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `website`            | A monitored site. `domain` is the primary key, `zone_id` is the Cloudflare Zone ID whose WAF rules get toggled. |
| `api`                | Optional extra endpoints to check for the same domain (method/header/body).                                     |
| `status` / `trigger` | Written automatically by the `scheduled` handler; not edited by hand.                                           |

To auto-lock a zone when a site is down, create a Cloudflare custom rule whose description starts with `auto:` — the health check will flip its `enabled` flag on failure and back off on recovery.

## Cloudflare API token (runtime)

This is the token the deployed Worker itself uses to edit WAF custom rulesets — separate from the deploy-time token used by CI (see below). Issue a Zone-scoped token that can edit WAF custom rulesets, then set it:

```txt
cp .dev.vars.example .dev.vars   # local dev
wrangler secret put CLOUDFLARE_API_TOKEN   # production, one-time — not managed by CI
```

## Production database (Neon + Hyperdrive)

1. Create a Postgres database on Neon and copy its connection string.
2. Create the Hyperdrive config and put the returned ID into `wrangler.jsonc`'s `hyperdrive[0].id`:
   ```txt
   wrangler hyperdrive create <name> --connection-string="postgres://..."
   ```
3. Add the connection string as the `DATABASE_URL` GitHub Actions secret (see below) so CI can migrate it, or run it manually:
   ```txt
   DATABASE_URL="postgres://..." bun run db:migrate
   ```

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request:

- **`ci`** — typecheck, lint, format check, build. Runs for all pushes and PRs.
- **`deploy`** — runs only on push to `main`, after `ci` passes: applies pending migrations to `DATABASE_URL`, then `bun run deploy` (build + `wrangler deploy`).

Configure these repository secrets for the `deploy` job to work:

| Secret                  | Used for                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`          | Direct Neon connection string, for `drizzle-kit migrate`                                                           |
| `CLOUDFLARE_API_TOKEN`  | Deploy auth for the `wrangler` CLI (needs Workers Scripts edit permission) — distinct from the runtime token above |
| `CLOUDFLARE_ACCOUNT_ID` | Account the Worker is deployed to                                                                                  |

The runtime `CLOUDFLARE_API_TOKEN` Worker secret (previous section) is set once via `wrangler secret put` and is intentionally not managed by CI.

## Scripts

```txt
bun run dev          # local dev (Vite + Cloudflare Workers runtime)
bun run build         # production build
bun run deploy        # build + wrangler deploy (normally run by the `deploy` CI job, not by hand)
bun run cf-typegen    # regenerate CloudflareBindings types from wrangler.jsonc
bun run db:generate   # generate a migration from schema changes
bun run db:migrate    # apply migrations to DATABASE_URL
bun run lint / format / typecheck
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and coding standards.
