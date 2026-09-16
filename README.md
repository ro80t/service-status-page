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

## Cloudflare API token

Issue a Zone-scoped token that can edit WAF custom rulesets, then set it:

```txt
cp .dev.vars.example .dev.vars   # local dev
wrangler secret put CLOUDFLARE_API_TOKEN   # production
```

## Production database (Neon + Hyperdrive)

1. Create a Postgres database on Neon and copy its connection string.
2. Create the Hyperdrive config and put the returned ID into `wrangler.jsonc`'s `hyperdrive[0].id`:
   ```txt
   wrangler hyperdrive create <name> --connection-string="postgres://..."
   ```
3. Run migrations directly against Neon (Hyperdrive is only used by the deployed Worker, not by drizzle-kit):
   ```txt
   DATABASE_URL="postgres://..." bun run db:migrate
   ```

## Scripts

```txt
bun run dev          # local dev (Vite + Cloudflare Workers runtime)
bun run build         # production build
bun run deploy        # build + wrangler deploy
bun run cf-typegen    # regenerate CloudflareBindings types from wrangler.jsonc
bun run db:generate   # generate a migration from schema changes
bun run db:migrate    # apply migrations to DATABASE_URL
bun run lint / format / typecheck
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and coding standards.
