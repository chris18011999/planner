# 13 — Host the app

**What to build:** The app runs on a server, so I can use it without my Mac. Any Google account can sign up there.

**Blocked by:** 09 — Sign in with Google. 11 — Store the Notes in Postgres. The privacy work from ticket 11: a privacy notice, a way to delete an account and all its data, and a database region in the EU.

**Status:** needs-triage

This is a placeholder. Refine it before work starts.

- [ ] The app binds to an address that the host can reach. A new ADR supersedes the network part of ADR 0002.
- [ ] The app uses a hosted Postgres in an EU region.
- [ ] The Google OAuth client has the redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google` for the hosted address.
- [ ] The secrets live in the secret store of the host, not in the repo.

## Comments

**Why the privacy work blocks this ticket:** Ticket 09 has no allowlist. As soon as the app is online, any Google account can sign up. Their emails and Notes are personal data under the GDPR.

**Open questions for triage:**

- Which host for the app: Vercel, Railway, Fly.io or an own server?
- Which Postgres host: Neon, Supabase, Railway or an own server? On a serverless host, Neon uses its own HTTP driver.
- Does the privacy work get its own ticket?
