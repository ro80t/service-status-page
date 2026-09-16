import { and, eq, lte } from "drizzle-orm";
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

export const recordStatus = async (db: Db, domain: string, status: number) => {
  const date = todayDate();
  const existing = await findStatus(db, domain, date);
  if (existing) {
    await db
      .update(statuses)
      .set({ status: [...existing.status, status] })
      .where(and(eq(statuses.domain, domain), eq(statuses.date, date)));
  } else {
    await db.insert(statuses).values({ domain, status: [status], date });
  }
};

export const removeOldStatuses = (db: Db, before: Date) =>
  db.delete(statuses).where(lte(statuses.date, before));

export const findTrigger = (db: Db, domain: string) =>
  db
    .select()
    .from(triggers)
    .where(eq(triggers.domain, domain))
    .then((rows) => rows[0] ?? null);

export const insertTrigger = (db: Db, domain: string) => {
  const limit = new Date(Date.now() + 60 * 60 * 1000);
  return db.insert(triggers).values({ domain, limit }).onConflictDoNothing();
};

export const removeTrigger = (db: Db, domain: string) =>
  db.delete(triggers).where(eq(triggers.domain, domain));

export const deleteExpiredTriggers = (db: Db) => {
  const limit = new Date(Date.now() - 60 * 60 * 1000);
  return db.delete(triggers).where(lte(triggers.limit, limit));
};
