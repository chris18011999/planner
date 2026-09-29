# 09 — Sign in with Google

**What to build:** The app asks for a sign-in with a Google account before it shows any page. Each User sees only their own Collection. My first sign-in connects me to the User that ticket 11 created from `OWNER_EMAIL`, so I keep my imported Notes.

**Blocked by:** 11 — Store the Notes in Postgres.

**Status:** ready-for-agent

- [ ] The app uses Better Auth with its Drizzle adapter and its Google provider.
- [ ] The schema adds the Better Auth tables `account`, `session` and `verification`. The `user` table comes from ticket 11.
- [ ] Every route needs a session: the Overview, the Note view, the New Note form and `/assets/<path>`.
- [ ] The proxy does only an optimistic check of the session cookie. It sends a request without the cookie to the sign-in page.
- [ ] The Collection module and every Server Action check the session themselves, because a request can call an action without the page. Create Note and Update Note refuse a call without a session.
- [ ] Every call to the Collection module takes the owner id from the session. The owner id never comes from the URL, a form field or the request body.
- [ ] The sign-in page has one "Sign in with Google" button. After the sign-in, the app opens the page that the request asked for.
- [ ] The return target is only a relative path that starts with a single `/`. Any other value gives `/`.
- [ ] Google must mark the email as verified. A sign-in with an unverified email fails.
- [ ] The app identifies a User by the Google `sub`, which Better Auth stores in `account`. A later sign-in finds the User by `sub`, not by email.
- [ ] Any Google account can sign up. The first sign-in of a new Google account creates a User.
- [ ] The first sign-in with the email of an existing User without an `account` row links to that User. This happens only when Google marks the email as verified. After the link, the app does not match by email again for that User.
- [ ] A new User starts with an empty Collection. The Overview then shows a short text and the "New note" button.
- [ ] Sessions live in the `session` table. The cookie cache of Better Auth is off, so a session that the server ends stops at once.
- [ ] A session lasts 7 days, and use extends it once a day. These are the Better Auth defaults.
- [ ] The Overview header shows the email of the User and a "Sign out" button. Sign out ends only the session on this device.
- [ ] The Google client ID, the client secret and the session secret come from `.env.local`. They never go into the repo, a log or an error page.
- [ ] `.env.example` lists the variable names with empty values: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- [ ] The app does not start when a required variable is missing. The error names the variable, but not its value.
- [ ] `OWNER_EMAIL` from ticket 11 goes away.
- [ ] The app still binds to `127.0.0.1`. Ticket 13 hosts the app.
- [ ] The README tells how to create the OAuth client in the Google Cloud console. The redirect URI is `<BETTER_AUTH_URL>/api/auth/callback/google`, for example `http://localhost:3000/api/auth/callback/google`.
- [ ] Tests check that User A cannot read, update or see in the Overview a Note or an Asset of User B, through each Collection operation.
- [ ] Tests check the new User at the first sign-in, the link to the `OWNER_EMAIL` User, the refusal of an unverified email, the return target check and the session check of Create Note and Update Note.
- [ ] ADR 0003 records the sign-in and the Users.
- [ ] The spec and CONTEXT.md record the sign-in and the Users.

## Comments

**Implementation decisions, confirmed by the user:**

- Better Auth, not Auth.js or an own flow. Auth.js v5 is still a beta, and its README tells new projects to start with Better Auth.
- The Google `sub` identifies a User. An email can change, and Google can give a freed address to a new person.
- No allowlist. Any Google account can sign up. The app stays on `127.0.0.1`, so nobody else can reach it yet. The privacy work blocks ticket 13.
- Database sessions without the cookie cache.
- Sign out ends only the session on this device. "Sign out on all devices" can come later.
- Hosting has its own ticket, 13.

**Why the owner id only from the session:** If a request can choose the owner id, any User can read the Notes of another User. Ticket 11 makes every query filter on the owner id. This ticket makes sure that the owner id is correct.

**Why the check in each Server Action:** The Next.js docs say that the proxy is only an optimistic check (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`). A request can call a Server Action directly, so each action checks the session itself.

**To confirm during the implementation:** Better Auth's account linking must link by email only when the email is verified. If its default differs, configure it.

**Secrets:** Do not paste the client secret or the session secret into a chat with an agent. Put them in `.env.local` yourself. Make the session secret with `openssl rand -base64 32`.
