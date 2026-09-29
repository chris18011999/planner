# 02 — Overview tracer bullet: Notes grouped per day

**What to build:** I set the Collection path in `.env.local` and open the app on `localhost`. The Overview lists all Notes in the Collection, grouped per Note date, with the newest day first. Undated Notes form the last group. In one day, Notes are in alphabetical filename order. Each Note shows its filename for now. The page follows the design from ticket 01.

**Blocked by:** 01 — UI prototype for the Overview and the Note view.

**Status:** done

- [x] The app is a Next.js App Router project in TypeScript.
- [x] The Collection module exposes the Overview model. A server component reads it at each request.
- [x] One environment variable in `.env.local` holds the Collection path. A `.env.example` documents it.
- [x] A missing or wrong Collection path gives an error page that names the environment variable.
- [x] The module reads `.md` files in the Collection and all subfolders.
- [x] The module skips dot-files, dot-folders and files that are not `.md`.
- [x] The Note date is a valid `YYYY-MM-DD` prefix of the filename. An invalid prefix gives an Undated Note.
- [x] Day groups are newest first. The Undated group is last. Notes in one group are in filename order.
- [x] A new or deleted Note shows in the Overview after a browser refresh.
- [x] Tests call the Overview model against a temporary fixture Collection.

## Comments

**Implementation decisions to confirm:**

- A date prefix followed by a digit, for example `2026-09-291-x.md`, gives an Undated Note.
- The filename order uses English collation, so case does not decide the order. The Note path breaks a tie between equal filenames.
- The module skips symbolic links to Notes and to folders. The spec does not mention symbolic links.
- The error page for a wrong Collection path returns HTTP status 200.
- The Note cards do not lift on hover yet. Ticket 04 adds the hover lift when the cards become links to the Note view.
- The Overview header shows the Note count. Ticket 03 replaces it with the count of Open Todos.
