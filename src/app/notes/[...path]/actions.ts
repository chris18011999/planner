"use server";

import { getNote, updateNote, type BlockRange, type Note, type NoteUpdate } from "@/collection/collection";
import { ownerId } from "../../owner";

export type SaveBlockResult = { note: Note; range: BlockRange } | { reason: "not found" | "changed on disk" };

export async function saveBlockAction(update: NoteUpdate): Promise<SaveBlockResult> {
  const owner = await ownerId();
  const result = await updateNote(owner, update);
  if ("reason" in result) return result;
  const note = await getNote(owner, update.path);
  if (!note) return { reason: "not found" };
  // Another tab saved the Note between the save and this read. The next save must not overwrite that change.
  if (note.version !== result.version) return { reason: "changed on disk" };
  return { note, range: result.range };
}
