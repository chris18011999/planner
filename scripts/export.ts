import { resolve } from "node:path";
import { exportFolder } from "../src/collection/folder";
import { requireUserId } from "../src/db/users";
import { parseFolderCommand, runCommand } from "./cli";

runCommand(async () => {
  const { folder, owner } = parseFolderCommand("npm run export -- <folder> --owner <email>");
  const target = resolve(folder);
  await exportFolder(await requireUserId(owner), target);
  console.log(`Wrote the Notes and Assets of ${owner} to ${target}.`);
});
