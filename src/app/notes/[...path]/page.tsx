import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CollectionPathError, getNote, type Note } from "@/collection/collection";
import { collectionPath } from "../../collection-path";
import { CollectionPathErrorPage } from "../../collection-path-error";
import { fullDate, localToday, relativeDay } from "../../dates";
import { FolderBadge } from "../../folder-badge";
import { ProgressRing } from "../../progress-ring";

const NOTE_CONTENT_CLASSES =
  "prose prose-neutral max-w-none dark:prose-invert prose-a:text-violet-600 dark:prose-a:text-violet-400 prose-li:my-0.5 [&_.contains-task-list]:list-none [&_.contains-task-list]:pl-0 [&_.contains-task-list_.contains-task-list]:pl-6 [&_.task-list-item_input]:mr-2";

export default async function NoteViewPage({ params }: PageProps<"/notes/[...path]">) {
  await connection();
  const notePath = decodeNotePath((await params).path);
  if (notePath === null) notFound();
  let note: Note | null;
  try {
    note = await getNote(collectionPath(), notePath);
  } catch (error) {
    if (error instanceof CollectionPathError) return <CollectionPathErrorPage message={error.message} />;
    throw error;
  }
  if (!note) notFound();

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="bg-gradient-to-br from-violet-600 to-indigo-700 px-6 pb-24 pt-8 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm text-violet-200 hover:text-white">
            ← All notes
          </Link>
          <div className="mt-8 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm text-violet-200">
                {note.date ? `${relativeDay(note.date, localToday())} · ${fullDate(note.date)}` : "Undated"}
              </p>
              <h1 className="mt-1 text-4xl font-black tracking-tight">{note.title}</h1>
            </div>
            {note.todoCount > 0 && (
              <div className="flex shrink-0 items-center gap-3 rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
                <span className="rounded-full bg-white p-0.5">
                  <ProgressRing openTodoCount={note.openTodoCount} todoCount={note.todoCount} />
                </span>
                <span className="text-sm leading-tight">
                  <b className="block text-lg">{note.openTodoCount} open</b>
                  of {note.todoCount} {note.todoCount === 1 ? "todo" : "todos"}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto -mt-16 max-w-3xl px-6 pb-16">
        <article className="rounded-xl border border-neutral-200 bg-white p-10 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-6 flex items-center gap-2">
            <FolderBadge notePath={note.path} />
            <span className="font-mono text-xs text-neutral-400">{note.path}.md</span>
          </div>
          <div className={NOTE_CONTENT_CLASSES} dangerouslySetInnerHTML={{ __html: note.html }} />
        </article>
      </main>
    </div>
  );
}

// Next.js passes catch-all segments still percent-encoded.
function decodeNotePath(segments: string[]): string | null {
  try {
    return segments.map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
}
