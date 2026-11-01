import { DurableObject } from "cloudflare:workers";

type Target = {
  url: string;
  method: string | null;
  header: Record<string, string> | null;
  body: unknown;
};
export type Site = { domain: string; url: string; zoneId: string; apis: Target[] };
// Everything the per-minute cron needs, so it only touches the DB on a flush.
export type State = {
  sites: Site[];
  triggers: Record<string, number>; // domain -> limit (ms)
  pending: Record<string, number[]>; // statuses not yet pushed to the DB
  flushedAt: number;
};

// One instance holds the state, so it survives between runs wherever the cron lands.
export class MonitorState extends DurableObject {
  load() {
    return this.ctx.storage.get<State>("state");
  }

  save(state: State) {
    return this.ctx.storage.put("state", state);
  }
}
