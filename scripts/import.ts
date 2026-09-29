import { resolve } from "node:path";
import { importFolder } from "../src/collection/folder";
import { requireUserId } from "../src/db/users";
import { parseFolderCommand, runCommand } from "./cli";

runCommand(async () => {
  const { folder, owner, dryRun } = parseFolderCommand("npm run import -- <folder> --owner <email> [--dry-run]", {
    allowDryRun: true,
  });
  const { created, existing } = await importFolder(await requireUserId(owner), resolve(folder), { dryRun });
  console.log(`${dryRun ? "Would create" : "Created"} ${created.length} files:`);
  for (const file of created) console.log(`  ${file}`);
  console.log(`Kept ${existing.length} files that exist in the database unchanged:`);
  for (const file of existing) console.log(`  ${file}`);
});
