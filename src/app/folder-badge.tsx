const COLOURS = [
  "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200",
];

function colourOf(folder: string) {
  let hash = 0;
  for (const char of folder) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLOURS[hash % COLOURS.length];
}

export function FolderBadge({ notePath }: { notePath: string }) {
  const parts = notePath.split("/");
  if (parts.length === 1) return null;
  const folder = parts[0];
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${colourOf(folder)}`}>{folder}</span>
  );
}
