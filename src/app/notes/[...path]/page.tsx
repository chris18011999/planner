import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getNote } from "@/collection/collection";
import { decodeUrlSegments } from "@/collection/urls";
import { fullDate, localToday, relativeDay } from "../../dates";
import { ownerId } from "../../owner";
import { NoteView } from "./note-view";

export default async function NoteViewPage({ params }: PageProps<"/notes/[...path]">) {
  await connection();
  const notePath = decodeUrlSegments((await params).path);
  if (notePath === null) notFound();
  const note = await getNote(await ownerId(), notePath);
  if (!note) notFound();
  const dateLabel = note.date ? `${relativeDay(note.date, localToday())} · ${fullDate(note.date)}` : "Undated";

  return <NoteView key={note.version} initialNote={note} dateLabel={dateLabel} />;
}
