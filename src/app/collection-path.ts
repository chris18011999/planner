import { join } from "node:path";

export const COLLECTION_PATH_VARIABLE = "COLLECTION_PATH";

export const DEFAULT_COLLECTION_FOLDER = "collection";

export function collectionPath() {
  return process.env[COLLECTION_PATH_VARIABLE] || join(process.cwd(), DEFAULT_COLLECTION_FOLDER);
}
