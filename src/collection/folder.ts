import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { exportNotes, importNote } from "./collection";

export type ImportFolderResult = {
  created: string[];
  existing: string[];
};

// A Note is text in Postgres. A file that is not valid UTF-8 fails, because a lossy decode breaks the export round trip.
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

// The import creates only. A Note path that exists stays unchanged, and the result lists its file.
export async function importFolder(
  ownerId: string,
  folder: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<ImportFolderResult> {
  const files = await listNoteFiles(folder, []);
  const existing = dryRun ? new Set((await exportNotes(ownerId)).map(({ path }) => path)) : null;
  const result: ImportFolderResult = { created: [], existing: [] };
  for (const file of files) {
    const path = file.replace(/\.md$/, "");
    const exists = existing
      ? existing.has(path)
      : (await importNote(ownerId, path, utf8.decode(await readFile(join(folder, file))))) === "exists";
    (exists ? result.existing : result.created).push(file);
  }
  return result;
}

export async function exportFolder(ownerId: string, folder: string): Promise<void> {
  const entries = await readdir(folder).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  if (entries.length > 0) throw new Error(`The folder "${folder}" is not empty.`);
  for (const { path, markdown } of await exportNotes(ownerId)) {
    const target = join(folder, `${path}.md`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, markdown, { flag: "wx" });
  }
}

// Dirent.isFile and Dirent.isDirectory are false for a symbolic link, so the import skips links without a check of its own.
async function listNoteFiles(folder: string, folders: string[]): Promise<string[]> {
  const entries = await readdir(join(folder, ...folders), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      files.push(...(await listNoteFiles(folder, [...folders, entry.name])));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push([...folders, entry.name].join("/"));
    }
  }
  return files;
}
