import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { user } from "./schema";

export async function findUserId(email: string): Promise<string | null> {
  const [row] = await db().select({ id: user.id }).from(user).where(eq(user.email, email));
  return row?.id ?? null;
}

export async function ensureUser(email: string): Promise<string> {
  await db()
    .insert(user)
    .values({ id: randomUUID(), name: email.split("@")[0], email })
    .onConflictDoNothing({ target: user.email });
  return (await findUserId(email))!;
}

export async function requireUserId(email: string): Promise<string> {
  const id = await findUserId(email);
  if (!id) throw new Error(`No User has the email ${email}. npm run db:migrate creates the User of OWNER_EMAIL.`);
  return id;
}
