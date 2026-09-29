import { join } from "node:path";
import { COLLECTION_PATH_VARIABLE, DEFAULT_COLLECTION_FOLDER } from "./collection-path-names";

export function collectionPath() {
  return process.env[COLLECTION_PATH_VARIABLE] || join(process.cwd(), DEFAULT_COLLECTION_FOLDER);
}
