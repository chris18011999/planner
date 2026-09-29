import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CollectionPathError, getNote, type Note } from "@/collection/collection";
import { decodeUrlSegments } from "@/collection/urls";
import { collectionPath } from "../../collection-path";
import { CollectionPathErrorPage } from "../../collection-path-error";
import { fullDate, localToday, relativeDay } from "../../dates";
import { NoteView } from "./note-view";

export default async function NoteViewPage({ params }: PageProps<"/notes/[...path]">) {
  await connection();
  const notePath = decodeUrlSegments((await params).path);
  if (notePath === null) notFound();
  let note: Note | null;
  try {
    note = await getNote(collectionPath(), notePath);
  } catch (error) {
    if (error instanceof CollectionPathError) return <CollectionPathErrorPage message={error.message} />;
    throw error;
  }
  if (!note) notFound();
  const dateLabel = note.date ? `${relativeDay(note.date, localToday())} · ${fullDate(note.date)}` : "Undated";

  return <NoteView key={note.version} initialNote={note} dateLabel={dateLabel} />;
}
