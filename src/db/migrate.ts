import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, db } from "./client";
import { loadEnvLocal, requiredEnv } from "./env";
import { ensureUser } from "./users";

async function main() {
  loadEnvLocal();
  await migrate(db(), { migrationsFolder: "drizzle" });
  const ownerEmail = requiredEnv("OWNER_EMAIL");
  await ensureUser(ownerEmail);
  console.log(`The database is up to date. The Owner is ${ownerEmail}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
