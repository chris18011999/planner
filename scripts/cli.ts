import { parseArgs } from "node:util";
import { closeDb } from "../src/db/client";
import { loadEnvLocal } from "../src/db/env";

export function parseFolderCommand(usage: string, { allowDryRun = false } = {}) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { owner: { type: "string" }, "dry-run": { type: "boolean" } },
  });
  const [folder] = positionals;
  const { owner, "dry-run": dryRun = false } = values;
  if (!folder || !owner || positionals.length > 1 || (dryRun && !allowDryRun)) throw new Error(`Usage: ${usage}`);
  return { folder, owner, dryRun };
}

export function runCommand(command: () => Promise<void>) {
  loadEnvLocal();
  command()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(closeDb);
}
