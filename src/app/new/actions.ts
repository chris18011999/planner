"use server";

import { redirect } from "next/navigation";
import { createNote } from "@/collection/collection";
import { noteHref } from "@/collection/urls";
import { localToday } from "../dates";
import { ownerId } from "../owner";

export type NewNoteFormState = {
  title: string;
  body: string;
  error?: string;
};

const FAILURE_MESSAGES = {
  exists: "A Note with this name already exists",
  "invalid title": "The Note title needs at least one letter or digit",
};

export async function createNoteAction(_: NewNoteFormState, formData: FormData): Promise<NewNoteFormState> {
  const title = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");
  const result = await createNote(await ownerId(), { title, body, date: localToday() });
  if ("reason" in result) return { title, body, error: FAILURE_MESSAGES[result.reason] };
  redirect(noteHref(result.path));
}
