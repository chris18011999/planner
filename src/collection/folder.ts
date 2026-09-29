import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  assetMediaType,
  existingPaths,
  exportAssets,
  exportNotes,
  importAsset,
  importNote,
  type ImportResult,
} from "./collection";

export type ImportFolderResult = {
  created: string[];
  existing: string[];
};

type FolderFile = { file: string; kind: "note" | "asset" };

// A Note is text in Postgres. A file that is not valid UTF-8 fails, because a lossy decode breaks the export round trip.
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

// The import creates only. A Note path or an Asset path that exists stays unchanged, and the result lists its file.
export async function importFolder(
  ownerId: string,
  folder: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<ImportFolderResult> {
  const folderFiles = await listFolderFiles(folder, []);
  const existing = dryRun ? await existingPaths(ownerId) : null;
  const result: ImportFolderResult = { created: [], existing: [] };
  for (const folderFile of folderFiles) {
    const exists = existing
      ? existing[folderFile.kind === "note" ? "notes" : "assets"].has(storedPath(folderFile))
      : (await importFile(ownerId, folder, folderFile)) === "exists";
    (exists ? result.existing : result.created).push(folderFile.file);
  }
  return result;
}

export async function exportFolder(ownerId: string, folder: string): Promise<void> {
  const entries = await readdir(folder).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  if (entries.length > 0) throw new Error(`The folder "${folder}" is not empty.`);
  const [notes, assets] = await Promise.all([exportNotes(ownerId), exportAssets(ownerId)]);
  const files = [
    ...notes.map(({ path, markdown }) => ({ file: `${path}.md`, content: markdown })),
    ...assets.map(({ path, content }) => ({ file: path, content })),
  ];
  for (const { file, content } of files) {
    const target = join(folder, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { flag: "wx" });
  }
}

async function importFile(ownerId: string, folder: string, folderFile: FolderFile): Promise<ImportResult> {
  const content = await readFile(join(folder, folderFile.file));
  return folderFile.kind === "note"
    ? importNote(ownerId, storedPath(folderFile), utf8.decode(content))
    : importAsset(ownerId, storedPath(folderFile), content);
}

function storedPath({ file, kind }: FolderFile) {
  return kind === "note" ? file.replace(/\.md$/, "") : file;
}

// Dirent.isFile and Dirent.isDirectory are false for a symbolic link, so the import skips links without a check of its own.
async function listFolderFiles(folder: string, folders: string[]): Promise<FolderFile[]> {
  const entries = await readdir(join(folder, ...folders), { withFileTypes: true });
  const files: FolderFile[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    if (entry.name.startsWith(".")) continue;
    const file = [...folders, entry.name].join("/");
    if (entry.isDirectory()) {
      files.push(...(await listFolderFiles(folder, [...folders, entry.name])));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push({ file, kind: "note" });
    } else if (entry.isFile() && assetMediaType(entry.name)) {
      files.push({ file, kind: "asset" });
    }
  }
  return files;
}
