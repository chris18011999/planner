import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Root } from "mdast";
import { db } from "../db/client";
import { notes } from "../db/schema";
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

const SLUG_LIMIT = 60;

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

export type ImportResult = "created" | "exists";

export type NoteFile = { path: string; markdown: string };

export async function getOverview(ownerId: string): Promise<DayGroup[]> {
  const rows = await db()
    .select({
      path: notes.path,
      date: notes.date,
      title: notes.title,
      openTodoCount: notes.openTodoCount,
      todoCount: notes.todoCount,
    })
    .from(notes)
    .where(eq(notes.ownerId, ownerId));
  const dated = new Map<string, OverviewNote[]>();
  const undated: OverviewNote[] = [];
  for (const { date, ...row } of rows) {
    const note = { ...row, filename: filename(row.path) };
    if (date) dated.set(date, [...(dated.get(date) ?? []), note]);
    else undated.push(note);
  }
  const groups: DayGroup[] = [...dated.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, notes]) => ({ date, notes: notes.sort(byFilename) }));
  if (undated.length > 0) groups.push({ date: null, notes: undated.sort(byFilename) });
  return groups;
}

export async function getNote(ownerId: string, notePath: string): Promise<Note | null> {
  const row = await findNote(ownerId, notePath);
  if (!row) return null;
  const tree = parseNote(row.markdown);
  return {
    path: row.path,
    filename: filename(row.path),
    title: row.title,
    openTodoCount: row.openTodoCount,
    todoCount: row.todoCount,
    date: row.date,
    version: row.version,
    length: row.markdown.length,
    ...renderNote(tree, row.path.split("/").slice(0, -1), row.markdown),
  };
}

export async function createNote(ownerId: string, { title, body, date }: NewNote): Promise<CreateNoteResult> {
  const trimmedTitle = title.trim();
  const titleSlug = slug(trimmedTitle);
  if (/[\r\n]/.test(trimmedTitle) || !titleSlug) return { reason: "invalid title" };
  const path = `${date}-${titleSlug}`;
  const normalizedBody = body.replace(/\r\n?/g, "\n").trimEnd();
  const content = normalizedBody ? `# ${trimmedTitle}\n\n${normalizedBody}\n` : `# ${trimmedTitle}\n`;
  const result = await insertNote(ownerId, path, content);
  return result === "exists" ? { reason: "exists" } : { path };
}

export async function updateNote(
  ownerId: string,
  { path, version, range, markdown }: NoteUpdate,
): Promise<UpdateNoteResult> {
  const row = await findNote(ownerId, path);
  if (!row) return { reason: "not found" };
  if (row.version !== version) return { reason: "changed on disk" };
  const tree = parseNote(row.markdown);
  checkRange(row.markdown, tree, range);
  const { content, range: newRange } = replaceBlock(row.markdown, tree, range, markdown);
  const fields = derivedFields(path, content);
  // The version in the WHERE clause makes the check and the write one step. A save from another tab in between changes no row.
  const updated = await db()
    .update(notes)
    .set({ markdown: content, ...fields })
    .where(and(eq(notes.id, row.id), eq(notes.ownerId, ownerId), eq(notes.version, version)))
    .returning({ id: notes.id });
  if (updated.length === 0) return { reason: "changed on disk" };
  return { version: fields.version, range: newRange };
}

// The import writes Notes with the paths from the folder.
export async function importNote(ownerId: string, path: string, markdown: string): Promise<ImportResult> {
  checkPath(path);
  return insertNote(ownerId, path, markdown);
}

export async function exportNotes(ownerId: string): Promise<NoteFile[]> {
  return db().select({ path: notes.path, markdown: notes.markdown }).from(notes).where(eq(notes.ownerId, ownerId));
}

// Postgres rejects a null byte in a text parameter. No stored path has one, so such a path is not found.
async function findNote(ownerId: string, notePath: string) {
  if (notePath.includes("\0")) return null;
  const [row] = await db()
    .select()
    .from(notes)
    .where(and(eq(notes.ownerId, ownerId), eq(notes.path, notePath)));
  return row ?? null;
}

async function insertNote(ownerId: string, path: string, markdown: string): Promise<ImportResult> {
  const inserted = await db()
    .insert(notes)
    .values({ ownerId, path, markdown, ...derivedFields(path, markdown) })
    .onConflictDoNothing({ target: [notes.ownerId, notes.path] })
    .returning({ id: notes.id });
  return inserted.length > 0 ? "created" : "exists";
}

// The Overview reads these columns, so it does not parse each Note.
function derivedFields(path: string, markdown: string) {
  const tree = parseNote(markdown);
  const name = path.split("/").at(-1)!;
  return {
    version: hash(markdown),
    date: noteDate(name),
    title: headingTitle(tree) ?? name,
    ...countTodos(tree),
  };
}

// The Collection holds only paths that the folder import accepts. So the export can write each path back as a file.
function checkPath(path: string) {
  const valid = path.split("/").every((segment) => segment && !segment.startsWith(".") && !segment.includes("\0"));
  if (!valid) throw new Error(`The path "${path}" has an empty segment, a segment that starts with "." or a null byte.`);
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

function noteDate(filename: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(filename);
  if (!match) return null;
  const [date, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return parsed.toISOString().startsWith(date) ? date : null;
}

function filename(path: string) {
  return `${path.split("/").at(-1)}.md`;
}

function hash(markdown: string) {
  return createHash("sha256").update(markdown).digest("hex");
}

function byFilename(a: OverviewNote, b: OverviewNote) {
  return a.filename.localeCompare(b.filename, "en") || a.path.localeCompare(b.path, "en");
}
