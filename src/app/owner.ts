import { requiredEnv } from "@/db/env";
import { requireUserId } from "@/db/users";

// Until ticket 09 adds sign-in, the app has one User: the User with the email in OWNER_EMAIL.
export function ownerId(): Promise<string> {
  return requireUserId(requiredEnv("OWNER_EMAIL"));
}
