import { existsSync } from "node:fs";

// Next.js loads .env.local for the app. The scripts, Drizzle Kit and the tests run outside Next.js, so they load it here.
export function loadEnvLocal() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in .env.local. See .env.example.`);
  return value;
}
