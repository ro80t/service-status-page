export {};

// CLOUDFLARE_API_TOKEN is set via `wrangler secret put` (and `.dev.vars` locally),
// not declared in wrangler.jsonc, so `wrangler types` never generates it.
declare global {
  interface CloudflareBindings {
    CLOUDFLARE_API_TOKEN: string;
  }
}
