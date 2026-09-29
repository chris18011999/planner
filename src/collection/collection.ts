import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, join } from "node:path";
import type { Root } from "mdast";
import { countTodos, headingTitle, parseNote, renderNote, type TodoCounts } from "./markdown";

export type OverviewNote = TodoCounts & {
  path: string;
  filename: string;
  title: string;
};

export type DayGroup = {
  date: string | null;
  notes: OverviewNote[];
};

export type Note = OverviewNote & {
  date: string | null;
  html: string;
};

export type Asset = {
  content: Buffer;
  mediaType: string;
};

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

type NoteLocation = {
  folders: string[];
  filename: string;
};

export class CollectionPathError extends Error {
  name = "CollectionPathError";
}

export async function getOverview(collectionPath: string | undefined): Promise<DayGroup[]> {
  const checkedPath = await checkCollectionPath(collectionPath);
  const locations = await listNoteLocations(checkedPath, []);
  const readNotes = await Promise.all(locations.map((location) => readOverviewNote(checkedPath, location)));
  const notes = readNotes.filter((note) => note !== null);
  const dated = new Map<string, OverviewNote[]>();
  const undated: OverviewNote[] = [];
  for (const note of notes) {
    const date = noteDate(note.filename);
    if (date) dated.set(date, [...(dated.get(date) ?? []), note]);
    else undated.push(note);
  }
  const groups: DayGroup[] = [...dated.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, notes]) => ({ date, notes: notes.sort(byFilename) }));
  if (undated.length > 0) groups.push({ date: null, notes: undated.sort(byFilename) });
  return groups;
}

export async function getNote(collectionPath: string | undefined, notePath: string): Promise<Note | null> {
  const checkedPath = await checkCollectionPath(collectionPath);
  const location = await findNote(checkedPath, notePath);
  if (!location) return null;
  const tree = await readNoteTree(checkedPath, location);
  if (!tree) return null;
  return {
    ...overviewNote(location, tree),
    date: noteDate(location.filename),
    html: renderNote(tree, location.folders),
  };
}

export async function getAsset(collectionPath: string | undefined, assetPath: string): Promise<Asset | null> {
  const checkedPath = await checkCollectionPath(collectionPath);
  const mediaType = IMAGE_MEDIA_TYPES[extname(assetPath).toLowerCase()];
  if (!mediaType) return null;
  const file = await findFile(checkedPath, assetPath.split("/"));
  if (!file) return null;
  // The Collection is read at runtime and is never part of the build output.
  const content = await readFile(/*turbopackIgnore: true*/ file).catch(missingAsNull);
  return content && { content, mediaType };
}

async function findNote(collectionPath: string, notePath: string): Promise<NoteLocation | null> {
  const segments = notePath.split("/");
  const location = { folders: segments.slice(0, -1), filename: `${segments.at(-1)}.md` };
  const file = await findFile(collectionPath, [...location.folders, location.filename]);
  return file ? location : null;
}

// The Overview lists no dot-files and no symbolic links. findFile rejects them too, for Notes and for Assets.
// The real path must equal the plain join. This check rejects "..", symbolic links and a case that differs from the disk.
async function findFile(collectionPath: string, segments: string[]): Promise<string | null> {
  if (segments.some((segment) => !segment || segment.startsWith("."))) return null;
  const [realCollection, realFile] = await Promise.all([
    realpath(collectionPath),
    realpath(join(collectionPath, ...segments)).catch(() => null),
  ]);
  if (realFile !== join(realCollection, ...segments)) return null;
  const file = await stat(realFile).catch(() => null);
  return file?.isFile() ? realFile : null;
}

async function readOverviewNote(
  collectionPath: string,
  { folders, filename }: NoteLocation,
): Promise<OverviewNote | null> {
  const tree = await readNoteTree(collectionPath, { folders, filename });
  return tree && overviewNote({ folders, filename }, tree);
}

async function readNoteTree(collectionPath: string, { folders, filename }: NoteLocation): Promise<Root | null> {
  const markdown = await readFile(join(collectionPath, ...folders, filename), "utf8").catch(missingAsNull);
  return markdown === null ? null : parseNote(markdown);
}

// Editors that save through a temporary file and a rename can remove a Note between the lookup and readFile.
function missingAsNull(error: NodeJS.ErrnoException): null {
  if (error?.code === "ENOENT") return null;
  throw error;
}

function overviewNote({ folders, filename }: NoteLocation, tree: Root): OverviewNote {
  const name = filename.replace(/\.md$/, "");
  return {
    path: [...folders, name].join("/"),
    filename,
    title: headingTitle(tree) ?? name,
    ...countTodos(tree),
  };
}

async function checkCollectionPath(collectionPath: string | undefined): Promise<string> {
  if (!collectionPath) throw new CollectionPathError("The Collection path is not set.");
  if (!isAbsolute(collectionPath)) {
    throw new CollectionPathError(`The Collection path "${collectionPath}" is not an absolute path.`);
  }
  const folder = await stat(collectionPath).catch(() => null);
  if (!folder?.isDirectory()) {
    throw new CollectionPathError(`The Collection path "${collectionPath}" is not a folder.`);
  }
  return collectionPath;
}

function noteDate(filename: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(filename);
  if (!match) return null;
  const [date, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return parsed.toISOString().startsWith(date) ? date : null;
}

function byFilename(a: OverviewNote, b: OverviewNote) {
  return a.filename.localeCompare(b.filename, "en") || a.path.localeCompare(b.path, "en");
}

async function listNoteLocations(collectionPath: string, folders: string[]): Promise<NoteLocation[]> {
  const entries = await readdir(join(collectionPath, ...folders), { withFileTypes: true });
  const locations: NoteLocation[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      locations.push(...(await listNoteLocations(collectionPath, [...folders, entry.name])));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      locations.push({ folders, filename: entry.name });
    }
  }
  return locations;
}
