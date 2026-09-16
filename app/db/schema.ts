import { date, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const websites = pgTable("website", {
  domain: text("domain").primaryKey(),
  zoneId: text("zone_id").notNull(),
  url: text("url").notNull(),
  label: text("label"),
});

export const apis = pgTable(
  "api",
  {
    domain: text("domain").notNull(),
    url: text("url").notNull(),
    method: text("method"),
    header: jsonb("header").$type<Record<string, string>>(),
    body: jsonb("body"),
  },
  (t) => [primaryKey({ columns: [t.domain, t.url] })],
);

export const statuses = pgTable(
  "status",
  {
    domain: text("domain").notNull(),
    status: integer("status").array().notNull(),
    date: date("date", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.domain, t.date] })],
);

export const triggers = pgTable("trigger", {
  domain: text("domain").primaryKey(),
  limit: timestamp("limit", { mode: "date" }).notNull(),
});
