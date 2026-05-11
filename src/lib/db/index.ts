import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __DRINK_EXCHANGE_DB__: ReturnType<typeof drizzle> | undefined;
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (globalThis.__DRINK_EXCHANGE_DB__) return globalThis.__DRINK_EXCHANGE_DB__;
  const sql = postgres(url, { prepare: false });
  const db = drizzle(sql, { schema });
  globalThis.__DRINK_EXCHANGE_DB__ = db;
  return db;
}

export { schema };
