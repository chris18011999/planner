import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join } from "node:path";
import type { Root } from "mdast";
import {
  blockNodes,
  bodyStart,
  countTodos,
  headingTitle,
  parseNote,
  renderNote,
  type BlockRange,
  type NoteBlock,
  type TodoCounts,
} from "./markdown";

export type { BlockRange, NoteBlock };

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
  version: string;
  length: number;
  blocks: NoteBlock[];
};

export type Asset = {
  content: Buffer;
  mediaType: string;
};

const SLUG_LIMIT = 60;

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export type NewNote = {
  title: string;
  body: string;
  date: string;
};

export type CreateNoteResult = { path: string } | { reason: "exists" | "invalid title" };

export type NoteUpdate = {
  path: string;
  version: string;
  range: BlockRange;
  markdown: string;
};

export type UpdateNoteResult = { version: string; range: BlockRange } | { reason: "not found" | "changed on disk" };

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
  const source = await readNoteSource(checkedPath, location);
  if (!source) return null;
  const tree = parseNote(source.markdown);
  return {
    ...overviewNote(location, tree),
    date: noteDate(location.filename),
    version: source.version,
    length: source.markdown.length,
    ...renderNote(tree, location.folders, source.markdown),
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

export async function createNote(
  collectionPath: string | undefined,
  { title, body, date }: NewNote,
): Promise<CreateNoteResult> {
  const checkedPath = await checkCollectionPath(collectionPath);
  const trimmedTitle = title.trim();
  const titleSlug = slug(trimmedTitle);
  if (/[\r\n]/.test(trimmedTitle) || !titleSlug) return { reason: "invalid title" };
  const path = `${date}-${titleSlug}`;
  const normalizedBody = body.replace(/\r\n?/g, "\n").trimEnd();
  const content = normalizedBody ? `# ${trimmedTitle}\n\n${normalizedBody}\n` : `# ${trimmedTitle}\n`;
  try {
    await writeFile(join(checkedPath, `${path}.md`), content, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return { reason: "exists" };
    throw error;
  }
  return { path };
}

export async function updateNote(
  collectionPath: string | undefined,
  { path, version, range, markdown }: NoteUpdate,
): Promise<UpdateNoteResult> {
  const checkedPath = await checkCollectionPath(collectionPath);
  const location = await findNote(checkedPath, path);
  const source = location && (await readNoteSource(checkedPath, location));
  if (!location || !source) return { reason: "not found" };
  if (source.version !== version) return { reason: "changed on disk" };
  const tree = parseNote(source.markdown);
  checkRange(source.markdown, tree, range);
  const { content, range: newRange } = replaceBlock(source.markdown, tree, range, markdown);
  const file = join(checkedPath, ...location.folders, location.filename);
  await replaceFile(file, content);
  return { version: hash(Buffer.from(content)), range: newRange };
}

function checkRange(markdown: string, tree: Root, { start, end }: BlockRange) {
  const valid =
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    (start >= bodyStart(tree) || start === markdown.length) &&
    start <= end &&
    end <= markdown.length &&
    (start < end || start === markdown.length);
  if (!valid) throw new Error(`The range ${start}-${end} is not a range of the Note body.`);
}

const LIST_ITEM = /^(?:[*+-]|\d{1,9}[.)])(?:[ \t]|$)/;

// An empty range at the end of the file adds a block. New Markdown without text removes the block and its blank lines.
function replaceBlock(markdown: string, tree: Root, { start, end }: BlockRange, newMarkdown: string) {
  const lineEnding = markdown.includes("\r\n") ? "\r\n" : "\n";
  const text = newMarkdown
    .replace(/\r\n?/g, "\n")
    .replace(/^(?:[ \t]*\n)+/, "")
    .trimEnd()
    .replace(/\n/g, lineEnding);
  if (start === end) {
    if (!text) return { content: markdown, range: { start, end } };
    const before = markdown.trimEnd();
    const lastBlock = blockNodes(tree).at(-1);
    const separator = !before ? "" : lastBlock?.type === "listItem" && LIST_ITEM.test(text) ? lineEnding : lineEnding.repeat(2);
    const blockStart = before.length + separator.length;
    return {
      content: before + separator + text + lineEnding,
      range: { start: blockStart, end: blockStart + text.length },
    };
  }
  if (text) {
    return {
      content: markdown.slice(0, start) + text + markdown.slice(end),
      range: { start, end: start + text.length },
    };
  }
  const blankLines = /^(?:[ \t]*\r?\n)*/.exec(markdown.slice(end))![0];
  const nextStart = end + blankLines.length;
  if (nextStart < markdown.length) {
    return { content: markdown.slice(0, start) + markdown.slice(nextStart), range: { start, end: start } };
  }
  const previousEnd = markdown.slice(0, start).trimEnd().length;
  return {
    content: previousEnd > 0 ? markdown.slice(0, previousEnd) + lineEnding : "",
    range: { start: previousEnd, end: previousEnd },
  };
}

// The temporary file starts with a ".", so the Overview skips it. The rename replaces the Note in one step.
async function replaceFile(file: string, content: string) {
  const { mode } = await stat(file);
  const temporary = join(dirname(file), `.${randomUUID()}.tmp`);
  await writeFile(temporary, content, { flag: "wx", mode });
  try {
    await rename(temporary, file);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

// NFKD splits "é" into "e" and a combining mark, but it keeps these letters whole.
const PLAIN_LETTERS: Record<string, string> = { ß: "ss", æ: "ae", ø: "o", œ: "oe", ł: "l" };

function slug(title: string) {
  const plain = title
    .toLowerCase()
    .replace(/[ßæøœł]/g, (letter) => PLAIN_LETTERS[letter])
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
  const full = plain.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (full.length <= SLUG_LIMIT) return full;
  // The search includes the character after the limit, so a "-" there keeps all 60 characters.
  const cut = full.slice(0, SLUG_LIMIT + 1).lastIndexOf("-");
  return full.slice(0, cut > 0 ? cut : SLUG_LIMIT);
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

async function readOverviewNote(collectionPath: string, location: NoteLocation): Promise<OverviewNote | null> {
  const source = await readNoteSource(collectionPath, location);
  return source && overviewNote(location, parseNote(source.markdown));
}

async function readNoteSource(
  collectionPath: string,
  { folders, filename }: NoteLocation,
): Promise<{ markdown: string; version: string } | null> {
  const content = await readFile(join(collectionPath, ...folders, filename)).catch(missingAsNull);
  return content && { markdown: content.toString("utf8"), version: hash(content) };
}

function hash(content: Buffer) {
  return createHash("sha256").update(content).digest("hex");
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
