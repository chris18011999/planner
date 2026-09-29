# 4. Postgres is the source of truth for Notes

Status: accepted, 2026-09-29

Supersedes the file-based parts of `0001-the-app-creates-notes.md` and `0002-the-app-edits-notes.md`.

## Context

The app read the Collection from a folder on my Mac. I want to host the app, give each User their own Collection and share a Note later. A folder on my Mac cannot do this. The Overview also parsed each Note at each page load. This works for a local folder, but it is slow over a network.

## Decision

The app keeps all Notes in Postgres. It no longer reads a folder. It has no Assets for now.

- Drizzle ORM with the `postgres` driver gives the connection. Drizzle Kit owns the migrations in `drizzle/`.
- The `user` table has the Better Auth shape, so ticket 09 needs no data migration.
- Each Note has an owner id. Every query of the Collection module filters on it.
- The Note path keeps its form, for example `work/2026-09-29-standup`. The owner id and the Note path together are unique. Note view URLs and relative links do not change.
- The `markdown` column holds the full content with the frontmatter. The version stays the SHA-256 hash of that content.
- Each write computes the Note date, the Note title and the Todo counts, and stores them in columns. The Overview reads only these columns.
- The app stores no Assets. The `/assets/<path>` route is gone, so a relative image in a Note does not load. A later ticket decides the storage of Assets.
- Create Note uses the unique index in place of the `wx` flag. A duplicate Note path gives "exists".
- Update Note checks the version in the `UPDATE` itself: `WHERE id = … AND version = …`. Zero changed rows gives "changed on disk".
- `npm run import` copies a folder into the database. It creates only. `npm run export` writes the Notes back as files. The import skips images.
- Until ticket 09 ships, `OWNER_EMAIL` gives the one User.

These parts of ADR 0001 and ADR 0002 stay valid: the slug rules, the block editing rules, the refusal of an old version and the bind to `127.0.0.1`.

## Considered options

- **Keep the folder and sync it with the database**: two sources of truth. Each change needs a conflict rule.
- **Parse each Note at each Overview load**: no derived columns, but a read of all Markdown for each page load.
- **Assets as `bytea` values in Postgres**: simple for a few Users. I do not want image content in the database, so the Assets wait for a later decision, for example object storage such as S3 or Cloudflare R2.
- **PGlite in memory for the tests**: no Docker, but it is not the real server.

## Consequences

- I can no longer edit a Note in my own editor and see the change after a refresh. The export is the way out.
- The app now needs a running Postgres. For development, `compose.yaml` starts one.
- The tests need that Postgres too. Each test file gets its own database, and each test starts with empty tables.
- The database holds personal data. Before other Users sign up, the app needs a privacy notice, account deletion and an EU database region. This blocks ticket 13.
- The images of my current Collection stay in the folder. The Note view shows no images until Assets come back.
- The Postgres host is still open. Ticket 13 decides it, and the host can change the driver.
