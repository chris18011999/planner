import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requiredEnv } from "./env";
import * as schema from "./schema";

function connect() {
  const client = postgres(requiredEnv("DATABASE_URL"));
  return { client, database: drizzle(client, { schema }) };
}

export type Database = ReturnType<typeof connect>["database"];

let connection: ReturnType<typeof connect> | undefined;

// The connection opens at the first query, so a test can set DATABASE_URL before it.
export function db(): Database {
  connection ??= connect();
  return connection.database;
}

export async function closeDb() {
  await connection?.client.end();
  connection = undefined;
}
