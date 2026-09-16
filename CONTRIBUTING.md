# Contributing

This document covers the day-to-day development workflow. For what the project does and how to run it, see [README.md](README.md).

## Project layout

```
app/
  db/           Drizzle schema (schema.ts), client factory (client.ts), query functions (repo.ts)
  lib/          Business logic: HTTP health checks, Cloudflare WAF rule toggling, the monitor loop
  pages/        Inertia + Vue pages
  server.ts     Hono routes + the Worker's `fetch`/`scheduled` exports
drizzle/        Generated SQL migrations (commit these)
```

## Workflow

1. `docker compose up -d` to get a local Postgres, then `bun run db:migrate`.
2. `bun run dev` starts Vite with the Cloudflare Workers runtime; this exercises both the SSR page and the `scheduled` handler locally.
3. To test the cron logic without waiting for the schedule, hit the local scheduled-event endpoint directly:
   ```txt
   curl "http://localhost:5173/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"
   ```
4. Before committing, run:
   ```txt
   bun run typecheck
   bun run lint
   bun run format
   ```

## Schema changes

Edit `app/db/schema.ts`, then generate and commit the migration:

```txt
bun run db:generate
```

Do not hand-edit files under `drizzle/`.

## Code style

- Formatting/linting is enforced by `oxfmt`/`oxlint` (`oxfmt.config.ts`, `oxlint.config.ts`) — run `bun run format` rather than hand-formatting.
- Prefer plain functions over classes for stateless logic (see `app/db/repo.ts`, `app/lib/*`); there is no dependency-injection layer to fit into.
- Keep `app/lib/monitor.ts` provider-agnostic where reasonable — it currently assumes Cloudflare WAF custom rules, gated by the `auto:` description prefix (`RULE_PREFIX` in `app/lib/monitor.ts`).
