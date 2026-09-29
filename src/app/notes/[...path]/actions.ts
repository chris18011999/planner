"use server";

import { getNote, updateNote, type BlockRange, type Note, type NoteUpdate } from "@/collection/collection";
import { collectionPath } from "../../collection-path";

export type SaveBlockResult = { note: Note; range: BlockRange } | { reason: "not found" | "changed on disk" };

export async function saveBlockAction(update: NoteUpdate): Promise<SaveBlockResult> {
  const result = await updateNote(collectionPath(), update);
  if ("reason" in result) return result;
  const note = await getNote(collectionPath(), update.path);
  if (!note) return { reason: "not found" };
  // Another program wrote the Note between the save and this read. The next save must not overwrite that change.
  if (note.version !== result.version) return { reason: "changed on disk" };
  return { note, range: result.range };
}
