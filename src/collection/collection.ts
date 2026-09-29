import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { countTodos, headingTitle, parseNote, type TodoCounts } from "./markdown";

export type OverviewNote = TodoCounts & {
  path: string;
  filename: string;
  title: string;
};

export type DayGroup = {
  date: string | null;
  notes: OverviewNote[];
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

async function readOverviewNote(
  collectionPath: string,
  { folders, filename }: NoteLocation,
): Promise<OverviewNote | null> {
  const name = filename.replace(/\.md$/, "");
  const markdown = await readFile(join(collectionPath, ...folders, filename), "utf8").catch((error) => {
    // Editors that save through a temporary file and a rename can remove a Note between readdir and readFile.
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (markdown === null) return null;
  const tree = parseNote(markdown);
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
