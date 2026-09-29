import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { closeDb, db } from "./client";
import { loadEnvLocal, requiredEnv } from "./env";

// Each test file gets its own database, so test files can run in parallel. Each test starts with empty tables.
export function setupTestDatabase() {
  const name = `planner_test_${process.env.VITEST_POOL_ID ?? "0"}`;
  let admin: postgres.Sql;

  beforeAll(async () => {
    loadEnvLocal();
    const url = new URL(requiredEnv("DATABASE_URL"));
    admin = postgres(url.href, { onnotice: () => {} });
    await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH (FORCE)`;
    await admin`CREATE DATABASE ${admin(name)}`;
    url.pathname = `/${name}`;
    process.env.DATABASE_URL = url.href;
    await migrate(db(), { migrationsFolder: "drizzle" });
  });

  beforeEach(async () => {
    await db().execute(sql`TRUNCATE "notes", "assets", "user" CASCADE`);
  });

  afterAll(async () => {
    await closeDb();
    await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH (FORCE)`;
    await admin.end();
  });
}
