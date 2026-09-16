import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

export const createDb = (connectionString: string) => {
  const client = postgres(connectionString, { max: 5, fetch_types: false, prepare: false });
  return drizzle(client, { schema });
};
