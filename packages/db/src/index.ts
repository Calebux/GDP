import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { createLogger, env } from "@gdp/core";
import * as schema from "./schema.js";

const log = createLogger("db");

export * from "./schema.js";
export { schema };

let pool: pg.Pool | null = null;
let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function pgPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: env().DATABASE_URL, max: 10 });
    pool.on("error", (error) => log.error("pool error", { error: String(error) }));
  }
  return pool;
}

export function db(): ReturnType<typeof drizzle<typeof schema>> {
  if (!database) database = drizzle(pgPool(), { schema });
  return database;
}

/** True when the database is reachable — the app degrades to in-memory without it. */
export async function dbAvailable(): Promise<boolean> {
  try {
    await pgPool().query("select 1");
    return true;
  } catch (error) {
    log.warn("database unavailable", { error: String(error) });
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
  database = null;
}
