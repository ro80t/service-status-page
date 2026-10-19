import { and, eq, lt } from "drizzle-orm";
import type { Db } from "./client";
import { apis, statuses, triggers, websites } from "./schema";

export const todayDate = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export const listWebsites = (db: Db) => db.select().from(websites);

export const listApis = (db: Db, domain: string) =>
  db.select().from(apis).where(eq(apis.domain, domain));

export const listStatuses = (db: Db, domain: string) =>
  db.select().from(statuses).where(eq(statuses.domain, domain));

export const findStatus = (db: Db, domain: string, date: Date) =>
  db
    .select()
    .from(statuses)
    .where(and(eq(statuses.domain, domain), eq(statuses.date, date)))
    .then((rows) => rows[0] ?? null);

export const recordStatus = async (db: Db, domain: string, status: number[]) => {
  const date = todayDate();
  const existing = await findStatus(db, domain, date);
  if (existing) {
    await db
      .update(statuses)
      .set({ status: [...existing.status, ...status] })
      .where(and(eq(statuses.domain, domain), eq(statuses.date, date)));
  } else {
    await db.insert(statuses).values({ domain, status, date });
  }
};

export const removeOldStatuses = (db: Db, before: Date) =>
  db.delete(statuses).where(lt(statuses.date, before));

export const listTriggers = (db: Db) => db.select().from(triggers);

// Overwrites the trigger table with the cached truth.
export const replaceTriggers = async (db: Db, rows: { domain: string; limit: Date }[]) => {
  await db.delete(triggers);
  if (rows.length) await db.insert(triggers).values(rows);
};
