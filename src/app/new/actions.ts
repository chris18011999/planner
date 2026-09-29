"use server";

import { redirect } from "next/navigation";
import { CollectionPathError, createNote, type CreateNoteResult } from "@/collection/collection";
import { noteHref } from "@/collection/urls";
import { collectionPath } from "../collection-path";
import { localToday } from "../dates";

export type NewNoteFormState = {
  title: string;
  body: string;
  error?: string;
  collectionPathError?: string;
};

const FAILURE_MESSAGES = {
  exists: "A Note with this name already exists",
  "invalid title": "The Note title needs at least one letter or digit",
};

export async function createNoteAction(_: NewNoteFormState, formData: FormData): Promise<NewNoteFormState> {
  const title = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");
  let result: CreateNoteResult;
  try {
    result = await createNote(collectionPath(), { title, body, date: localToday() });
  } catch (error) {
    if (error instanceof CollectionPathError) return { title, body, collectionPathError: error.message };
    throw error;
  }
  if ("reason" in result) return { title, body, error: FAILURE_MESSAGES[result.reason] };
  redirect(noteHref(result.path));
}
