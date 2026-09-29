import { connection } from "next/server";
import { CollectionPathError, getOverview, type DayGroup } from "@/collection/collection";
import { fullDate, localToday, monthLabel, relativeDay, shortDate } from "./dates";
import { FolderBadge } from "./folder-badge";
import { ProgressRing } from "./progress-ring";

const COLLECTION_PATH_VARIABLE = "COLLECTION_PATH";

export default async function OverviewPage() {
  await connection();
  const today = localToday();
  let groups: DayGroup[];
  try {
    groups = await getOverview(process.env[COLLECTION_PATH_VARIABLE]);
  } catch (error) {
    if (error instanceof CollectionPathError) return <CollectionPathErrorPage message={error.message} />;
    throw error;
  }
  const notes = groups.flatMap((group) => group.notes);
  const openTodoCount = notes.reduce((sum, note) => sum + note.openTodoCount, 0);
  const openNoteCount = notes.filter((note) => note.openTodoCount > 0).length;

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="bg-gradient-to-br from-violet-600 to-indigo-700 px-6 pb-10 pt-12 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-violet-200">{fullDate(today)}</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">
            {openTodoCount} open {openTodoCount === 1 ? "todo" : "todos"}
          </h1>
          <p className="mt-2 text-violet-200">
            across {openNoteCount} of {notes.length} {notes.length === 1 ? "note" : "notes"}
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-16">
        {groups.map((group, index) => (
          <DaySection
            key={group.date ?? "undated"}
            group={group}
            previousDate={groups[index - 1]?.date ?? null}
            today={today}
          />
        ))}
      </main>
    </div>
  );
}

function DaySection({
  group,
  previousDate,
  today,
}: {
  group: DayGroup;
  previousDate: string | null;
  today: string;
}) {
  const { date, notes } = group;
  const month = date && monthLabel(date);
  const showMonth = month && (!previousDate || monthLabel(previousDate) !== month);

  return (
    <section>
      {showMonth && (
        <h2 className="mt-10 text-xs font-bold uppercase tracking-widest text-neutral-400">{month}</h2>
      )}
      <div
        className={`sticky top-0 z-10 -mx-6 mt-4 px-6 py-2 backdrop-blur ${
          date ? "bg-neutral-50/90 dark:bg-neutral-950/90" : "bg-neutral-200/90 dark:bg-neutral-800/90"
        }`}
      >
        <span className="text-lg font-bold">{date ? relativeDay(date, today) : "Undated"}</span>
        {date && <span className="ml-2 text-sm text-neutral-500">{shortDate(date)}</span>}
        <span className="ml-2 text-sm text-neutral-400">· {notes.length}</span>
      </div>
      <ul className="mt-2 space-y-2">
        {notes.map((note) => (
          <li
            key={note.path}
            className={`flex items-center gap-4 rounded-xl border bg-white px-4 py-3 shadow-sm dark:bg-neutral-900 ${
              date ? "border-neutral-200 dark:border-neutral-800" : "border-dashed border-neutral-300 dark:border-neutral-700"
            }`}
          >
            <ProgressRing openTodoCount={note.openTodoCount} todoCount={note.todoCount} />
            <span className="flex-1 font-semibold">{note.title}</span>
            <FolderBadge notePath={note.path} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CollectionPathErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen w-full bg-neutral-50 px-6 py-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <main className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-8 shadow-sm dark:border-red-900 dark:bg-neutral-900">
        <h1 className="text-2xl font-bold">The app cannot read the Collection</h1>
        <p className="mt-4">{message}</p>
        <p className="mt-4">
          Set <code className="font-mono font-semibold">{COLLECTION_PATH_VARIABLE}</code> in{" "}
          <code className="font-mono">.env.local</code> to the absolute path of your Collection folder. See{" "}
          <code className="font-mono">.env.example</code>. Then restart the app.
        </p>
      </main>
    </div>
  );
}
