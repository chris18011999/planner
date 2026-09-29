import type { TodoCounts } from "@/collection/markdown";

const RADIUS = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({ openTodoCount, todoCount }: TodoCounts) {
  const doneShare = todoCount === 0 ? 0 : (todoCount - openTodoCount) / todoCount;
  const label = todoCount === 0 ? "No todos" : openTodoCount === 0 ? "All todos done" : `${openTodoCount} open of ${todoCount} todos`;

  return (
    <span role="img" aria-label={label} className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={RADIUS} fill="none" strokeWidth="3" className="stroke-neutral-200 dark:stroke-neutral-800" />
        {todoCount > 0 && (
          <circle
            cx="18"
            cy="18"
            r={RADIUS}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - doneShare)}
            className={openTodoCount > 0 ? "stroke-violet-500" : "stroke-emerald-500"}
          />
        )}
      </svg>
      {todoCount > 0 && (
        <span
          aria-hidden
          className={`text-xs font-bold ${openTodoCount > 0 ? "text-violet-600 dark:text-violet-400" : "text-emerald-600"}`}
        >
          {openTodoCount || "✓"}
        </span>
      )}
    </span>
  );
}
