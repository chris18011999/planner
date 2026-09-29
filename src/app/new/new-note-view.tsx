"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createNoteAction, type NewNoteFormState } from "./actions";

const INITIAL_STATE: NewNoteFormState = { title: "", body: "" };

const FIELD_CLASSES =
  "mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950";

export function NewNoteView() {
  const [state, formAction, pending] = useActionState(createNoteAction, INITIAL_STATE);

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="bg-gradient-to-br from-violet-600 to-indigo-700 px-6 pb-24 pt-8 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm text-violet-200 hover:text-white">
            ← All notes
          </Link>
          <h1 className="mt-8 text-4xl font-black tracking-tight">New note</h1>
        </div>
      </header>
      <main className="mx-auto -mt-16 max-w-3xl px-6 pb-16">
        <form
          action={formAction}
          className="space-y-6 rounded-xl border border-neutral-200 bg-white p-10 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
        >
          <label className="block">
            <span className="font-semibold">Note title</span>
            <input name="title" required defaultValue={state.title} className={FIELD_CLASSES} />
          </label>
          <label className="block">
            <span className="font-semibold">Body</span>
            <textarea name="body" rows={12} defaultValue={state.body} className={`${FIELD_CLASSES} font-mono text-sm`} />
          </label>
          {state.error && (
            <p role="alert" className="text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          <button
            disabled={pending}
            className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            Create note
          </button>
        </form>
      </main>
    </div>
  );
}
