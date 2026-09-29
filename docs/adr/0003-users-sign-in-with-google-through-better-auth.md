# 3. Users sign in with Google through Better Auth

Status: accepted, 2026-09-29

## Context

Ticket 11 moves the Notes into Postgres and gives each Note and each Asset an Owner. More than one User can now use the app. The app must know who makes each request, and it must never show a Note to a User who is not its Owner.

## Decision

A User signs in with a Google account through Better Auth, with its Drizzle adapter.

- Better Auth owns the `user`, `account`, `session` and `verification` tables. Ticket 11 already creates `user` in the Better Auth shape.
- The Google `sub` identifies a User. Google never changes or reuses it. An email can change, and a Workspace admin can give a freed address to a new person.
- The User from `OWNER_EMAIL` has no `sub` before the first sign-in. That one sign-in links by email, and only when Google marks the email as verified. After the link, the app matches only by `sub`.
- Sessions live in the database. The cookie cache is off, so a session that the server ends stops at once.
- The proxy does only an optimistic cookie check. The Collection module and each Server Action check the session themselves, and the owner id comes only from the session.
- Any Google account can sign up. The app has no allowlist.

## Considered options

- **Auth.js v5**: still a beta. Its README tells new projects to start with Better Auth.
- **An own flow with `openid-client` and `jose`**: it gives full control, but the session, CSRF and callback code becomes our own security code.
- **Sessions in a signed cookie**: no database read for each request, but the server cannot end a session, for example after a stolen laptop.

## Consequences

- Each request reads the `session` table once. With few Users, this cost is small.
- The app still binds to `127.0.0.1`, so ADR 0002 stays unchanged. The hosting ticket changes the bind address.
- Open sign-up means that strangers can sign up as soon as the app goes online. The privacy work from ticket 11 must ship before the hosting ticket.
