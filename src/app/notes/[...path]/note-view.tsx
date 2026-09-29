"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { BlockRange, Note, NoteBlock } from "@/collection/collection";
import { FolderBadge } from "../../folder-badge";
import { ProgressRing } from "../../progress-ring";
import { saveBlockAction } from "./actions";
import { listEnter, toggleTodo } from "./block-editing";

const NOTE_CONTENT_CLASSES =
  "prose prose-neutral max-w-none dark:prose-invert prose-a:text-violet-600 dark:prose-a:text-violet-400 prose-li:my-0.5 [&_.contains-task-list]:list-none [&_.contains-task-list]:pl-0 [&_.contains-task-list_.contains-task-list]:pl-6 [&_.task-list-item_input]:mr-2";

const BLOCK_CLASSES = "-mx-2 cursor-text rounded px-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50";

const SAVE_DELAY = 2000;

// A range is valid for the version of the Note that it came from. Before the first save of a block,
// another save can change that version. locate then finds the block again by its Markdown.
type Target = BlockRange & { version: string; length: number; markdown: string };

type OpenBlock = { target: Target; initial: string; saved: string };

type Problem = "changed on disk" | "not found" | "save failed";

const PROBLEM_MESSAGES: Record<Problem, string> = {
  "changed on disk": "This Note changed on disk",
  "not found": "This Note is no longer on disk",
  "save failed": "The app could not save this Note",
};

type NoteViewProps = { initialNote: Note; dateLabel: string };

export function NoteView({ initialNote, dateLabel }: NoteViewProps) {
  const [note, setNote] = useState(initialNote);
  const [open, setOpen] = useState<OpenBlock | null>(() => (hasOnlyHeading(initialNote) ? newBlock(initialNote) : null));
  const [openRange, setOpenRange] = useState<BlockRange | null>(() => open && open.target);
  const [text, setText] = useState(open?.initial ?? "");
  const [problem, setProblem] = useState<Problem | null>(null);
  const noteRef = useRef(note);
  const openRef = useRef(open);
  const textRef = useRef(text);
  const problemRef = useRef(problem);
  const queueRef = useRef(Promise.resolve());
  const pendingRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function warnAboutUnsavedText(event: BeforeUnloadEvent) {
      const dirty = openRef.current && openRef.current.saved !== textRef.current;
      if (pendingRef.current > 0 || dirty) event.preventDefault();
    }
    window.addEventListener("beforeunload", warnAboutUnsavedText);
    return () => window.removeEventListener("beforeunload", warnAboutUnsavedText);
  }, []);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [text, open]);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [open]);

  function showProblem(next: Problem) {
    problemRef.current = next;
    setProblem(next);
  }

  function openBlock(block: OpenBlock) {
    openRef.current = block;
    textRef.current = block.initial;
    setOpen(block);
    setOpenRange(block.target);
    setText(block.initial);
  }

  function closeBlock() {
    clearTimeout(timerRef.current);
    openRef.current = null;
    setOpen(null);
    setOpenRange(null);
  }

  // Saves run one after the other. Each save reads the target and the version at its turn, after the save before it.
  function enqueueSave(
    target: () => Target,
    markdown: string,
    onSaved?: (current: Note, range: BlockRange) => void,
    onProblem?: () => void,
  ) {
    pendingRef.current++;
    queueRef.current = queueRef.current
      .then(async () => {
        if (problemRef.current) return;
        const range = locate(noteRef.current, target());
        if (!range) {
          showProblem("changed on disk");
          onProblem?.();
          return;
        }
        const result = await saveBlockAction({
          path: noteRef.current.path,
          version: noteRef.current.version,
          range,
          markdown,
        });
        if ("reason" in result) {
          showProblem(result.reason);
          onProblem?.();
          return;
        }
        noteRef.current = result.note;
        setNote(result.note);
        onSaved?.(result.note, result.range);
      })
      .catch(() => {
        showProblem("save failed");
        onProblem?.();
      })
      .finally(() => pendingRef.current--);
  }

  function saveOpenBlock(closing: boolean) {
    const block = openRef.current;
    if (!block) return;
    const markdown = textRef.current;
    if (markdown === block.saved || (!closing && !markdown.trim())) return;
    block.saved = markdown;
    enqueueSave(
      () => block.target,
      markdown,
      (current, range) => {
        block.target = { ...range, version: current.version, length: current.length, markdown };
        if (openRef.current === block) setOpenRange(range);
      },
      () => {
        // The text of the failed save stays on screen, unless the user opened another block since then.
        if (!openRef.current) openBlock({ ...block, initial: markdown });
      },
    );
  }

  function onBlur() {
    if (problemRef.current) return;
    saveOpenBlock(true);
    closeBlock();
  }

  function onChange(value: string) {
    textRef.current = value;
    setText(value);
    clearTimeout(timerRef.current);
    if (!problemRef.current) timerRef.current = setTimeout(() => saveOpenBlock(false), SAVE_DELAY);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const field = event.currentTarget;
    if (event.key === "Escape") {
      event.preventDefault();
      discardOpenBlock();
      return;
    }
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    const edit = listEnter(field.value, field.selectionStart, field.selectionEnd);
    if (!edit) return;
    event.preventDefault();
    field.setSelectionRange(edit.start, edit.end);
    // execCommand keeps the edit in the undo history of the field. setRangeText is the fallback.
    const command = edit.insert ? "insertText" : "delete";
    if (!document.execCommand(command, false, edit.insert)) {
      field.setRangeText(edit.insert, edit.start, edit.end, "end");
      onChange(field.value);
    }
  }

  function discardOpenBlock() {
    const block = openRef.current;
    if (!block) return;
    closeBlock();
    if (problemRef.current || block.saved === block.initial) return;
    enqueueSave(() => block.target, block.initial);
  }

  function onBlockClick(event: MouseEvent<HTMLElement>, block: NoteBlock) {
    const target = event.target as HTMLElement;
    if (target.closest("a")) return;
    const checkbox = target.closest<HTMLInputElement>("input[type=checkbox][data-offset]");
    if (checkbox) {
      event.preventDefault();
      if (!problemRef.current) toggle(block, Number(checkbox.dataset.offset));
      return;
    }
    if (problemRef.current || !window.getSelection()?.isCollapsed) return;
    const current = noteRef.current;
    openBlock({ target: targetOf(current, block), initial: block.markdown, saved: block.markdown });
  }

  function toggle(block: NoteBlock, offset: number) {
    const target = targetOf(noteRef.current, block);
    enqueueSave(() => target, toggleTodo(block.markdown, offset - block.start));
  }

  function onEmptyAreaClick() {
    if (problemRef.current || openRef.current) return;
    openBlock(newBlock(noteRef.current));
  }

  function copyText() {
    void navigator.clipboard.writeText(textRef.current);
  }

  const field = open && openRange && (
    <textarea
      key="open-block"
      ref={fieldRef}
      value={text}
      rows={1}
      aria-label="Block Markdown"
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="not-prose my-2 block w-full resize-none overflow-hidden rounded-lg border border-violet-300 bg-white px-3 py-2 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-violet-400 dark:border-violet-700 dark:bg-neutral-950"
    />
  );
  const visibleBlocks = openRange
    ? note.blocks.filter((block) => block.end <= openRange.start || block.start >= openRange.end)
    : note.blocks;
  const fieldIndex = openRange ? visibleBlocks.findIndex((block) => block.start >= openRange.end) : -1;
  const items = visibleBlocks.map((block) => (
    <div key={block.start} className={BLOCK_CLASSES} onClick={(event) => onBlockClick(event, block)}>
      {block.html ? (
        <div className="[&>ol]:my-0 [&>ul]:my-0" dangerouslySetInnerHTML={{ __html: block.html }} />
      ) : (
        <pre className="not-prose whitespace-pre-wrap py-1 font-mono text-sm text-neutral-400">{block.markdown}</pre>
      )}
    </div>
  ));
  if (field) items.splice(fieldIndex === -1 ? items.length : fieldIndex, 0, field);

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="bg-gradient-to-br from-violet-600 to-indigo-700 px-6 pb-24 pt-8 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm text-violet-200 hover:text-white">
            ← All notes
          </Link>
          <div className="mt-8 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm text-violet-200">{dateLabel}</p>
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
        {problem && (
          <div
            role="alert"
            className="sticky top-4 z-10 mb-4 flex items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            <span className="font-semibold">{PROBLEM_MESSAGES[problem]}</span>
            <span className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Reload
              </button>
              {open && (
                <button
                  onClick={copyText}
                  className="rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-900"
                >
                  Copy my text
                </button>
              )}
            </span>
          </div>
        )}
        <article className="rounded-xl border border-neutral-200 bg-white p-10 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-6 flex items-center gap-2">
            <FolderBadge notePath={note.path} />
            <span className="font-mono text-xs text-neutral-400">{note.path}.md</span>
          </div>
          <div className={NOTE_CONTENT_CLASSES}>{items}</div>
          <div aria-hidden className="min-h-24 cursor-text" onClick={onEmptyAreaClick} />
        </article>
      </main>
    </div>
  );
}

function hasOnlyHeading({ blocks }: Note) {
  return blocks.length === 0 || (blocks.length === 1 && /^# /.test(blocks[0].markdown));
}

function newBlock(note: Note): OpenBlock {
  return { target: { ...targetOf(note, { start: note.length, end: note.length }), markdown: "" }, initial: "", saved: "" };
}

function targetOf(note: Note, block: BlockRange & { markdown?: string }): Target {
  return { start: block.start, end: block.end, version: note.version, length: note.length, markdown: block.markdown ?? "" };
}

// A save changes only its own range. So a block before it keeps its offsets, and a block after it keeps its distance to the end.
function locate(note: Note, target: Target): BlockRange | null {
  if (note.version === target.version) return { start: target.start, end: target.end };
  if (target.start === target.end) return { start: note.length, end: note.length };
  const shift = note.length - target.length;
  const block = [target.start, target.start + shift]
    .map((start) => note.blocks.find((candidate) => candidate.start === start && candidate.markdown === target.markdown))
    .find((candidate) => candidate !== undefined);
  return block ? { start: block.start, end: block.end } : null;
}
