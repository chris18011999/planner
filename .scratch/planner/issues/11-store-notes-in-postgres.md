# 11 — Store the Notes in Postgres

**What to build:** The app keeps all Notes and Assets in a Postgres database, and it no longer reads the Collection folder. Each Note and each Asset belongs to one user. A one-time import moves my current Collection into the database. An export gives the Notes back as Markdown files. The app works as before for me, but it can now run on a server without my Mac.

**Blocked by:** none.

**Status:** done

- [x] The app uses Drizzle ORM with the `postgres` driver. `DATABASE_URL` in `.env.local` gives the connection. `.env.example` lists the name with an empty value.
- [x] Drizzle Kit owns the migrations, in `drizzle/`. `npm run db:generate` makes a migration and `npm run db:migrate` runs it.
- [x] A `compose.yaml` starts a local Postgres for development. Its password comes from `.env.local`, not from the file.
- [x] The schema has a `user` table in the shape of Better Auth: id, name, email (unique), email verified, image, created at and updated at. Ticket 09 uses this table without a migration.
- [x] The schema has a `notes` table: id, owner id (refers to `user.id`), Note path, Markdown, version, Note date, Note title, Open Todo count, created at and updated at. The owner id and the Note path together are unique.
- [x] The schema has an `assets` table: id, owner id (refers to `user.id`), Asset path, media type, content and created at. The owner id and the Asset path together are unique.
- [x] The Note path keeps its current form, for example `work/2026-09-29-standup`. Note view URLs and relative links in a Note work as before.
- [x] The Markdown column holds the full file content, with the frontmatter. The version stays the SHA-256 hash of that content.
- [x] Each write computes the Note date, Note title and Open Todo count from the Markdown, with the current parser. The Overview reads these columns and does not parse each Note.
- [x] The Collection module keeps its operations and its results: Overview model, Note by path, Asset by path, Create Note and Update Note. Each operation takes the owner id in place of the Collection path.
- [x] Every query filters on the owner id. No operation can read or change a Note or an Asset of another user.
- [x] Update Note does the version check and the write in one statement: `UPDATE … WHERE id = … AND version = …`. Zero changed rows gives "changed on disk".
- [x] Create Note uses the unique index in place of the `wx` flag. A duplicate Note path gives "exists".
- [x] Until ticket 09 ships, the app uses one user. `OWNER_EMAIL` in `.env.local` gives that user, and `npm run db:migrate` creates the user row if it does not exist.
- [x] `npm run import -- <folder> --owner <email>` reads the `.md` files and images of a folder into the database. It uses the current rules: no dot-files, no symbolic links and only the image types of Asset by path. It creates only. A Note path or an Asset path that exists stays unchanged, and the command lists it.
- [x] `npm run import` has a `--dry-run` flag that lists what it would create.
- [x] `npm run export -- <folder> --owner <email>` writes each Note and each Asset of a user to its path in the folder. It refuses a folder that is not empty.
- [x] The Collection path code, `COLLECTION_PATH`, the Collection path error page and the `collection` folder default go away after the import works.
- [x] Tests run the Collection module against a real Postgres. Each test gets an empty schema. The tests keep all current cases and add the owner isolation, the version check in one statement, and the import and export round trip.
- [x] A new ADR records that Postgres is the source of truth. It supersedes the file-based parts of ADR 0001 and ADR 0002.
- [x] The spec and CONTEXT.md record the database. A Collection now means all Notes and Assets of one user. The spec removes "no database" and moves "more than one user" into scope.

## Comments

**Implementation decisions, confirmed by the user:**

- Postgres is the only source of truth. The Markdown files are not synced back.
- Drizzle is the ORM.
- The reasons are hosting, richer queries, a Collection for each user and sharing later.

**What we lose:** I can no longer edit a Note in my own editor and see the change after a refresh. Spec stories 1 to 5, 8, 29 and 31 describe that workflow. The export is the way out if I want the files back.

**Why the owner id comes now:** Ticket 09 adds more users. If the schema has an owner id and the Better Auth `user` table from the start, ticket 09 needs no data migration. It adds only the `account`, `session` and `verification` tables.

**Why derived columns:** The Overview now shows all Notes of a user. Parsing every Note at each page load works for a folder on my Mac, but it is slow for a database over the network.

**Personal data:** With more users, the database holds their email addresses and their Notes. This is personal data under the GDPR. Before other users sign up, the app needs a privacy notice, a way to delete an account and all its data, and a database region in the EU. That work blocks ticket 13, which hosts the app.

**Open questions for triage:**

- Assets in a `bytea` column, or in object storage such as S3 or Cloudflare R2? `bytea` is simple and works for a few users. Object storage costs less when there are many images.
- Which Postgres host: Neon, Supabase, Railway or an own server? Ticket 13 can decide this. This choice also decides the driver. Neon on a serverless host uses its own HTTP driver.
- Tests against the `compose.yaml` Postgres, or against PGlite in memory? PGlite needs no Docker, but it is not the real server.
- Does the Note path stay the identity of a Note, or does the URL change to the note id? A path keeps relative links. An id lets a Note get a new title or folder without broken links.

**Implementation notes, 2026-09-29:**

- The open questions got these answers. Assets are `bytea`. The Postgres host stays open for ticket 13. The tests use the `compose.yaml` Postgres. The Note path stays the identity of a Note.
- The `notes` table also has a `todo_count` column. The progress ring of the Overview needs the count of all Todos, not only the Open Todos.
- Each test file gets its own database (`planner_test_<worker>`). Each test starts with empty tables through `TRUNCATE`. This costs less than a new database or schema for each test.
- The Collection module has four new operations for the import and the export: Import Note, Import Asset, Export Notes and Export Assets. `src/collection/folder.ts` owns the file rules.
- The tests that checked the file system are gone: the Collection path errors, the temporary dot-file of Update Note, and symbolic links at read time. The folder import tests now cover dot-files and symbolic links.
- `compose.yaml` publishes Postgres on port 5433 by default, because another project uses 5432. `POSTGRES_PORT` changes it.
- The reason stays "changed on disk", as this ticket asks. The Note view now says "This Note changed in another tab" for it, and "This Note no longer exists" for "not found".
- The import refuses a `.md` file that is not valid UTF-8. A lossy decode would break the export round trip.
- Both foreign keys to `user` use `ON DELETE CASCADE`. The account deletion from the GDPR work can then remove a User with one statement.
