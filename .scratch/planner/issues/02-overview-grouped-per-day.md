# 02 — Overview tracer bullet: Notes grouped per day

**What to build:** I set the Collection path in `.env.local` and open the app on `localhost`. The Overview lists all Notes in the Collection, grouped per Note date, with the newest day first. Undated Notes form the last group. In one day, Notes are in alphabetical filename order. Each Note shows its filename for now. The page follows the design from ticket 01.

**Blocked by:** 01 — UI prototype for the Overview and the Note view.

**Status:** ready-for-agent

- [ ] The app is a Next.js App Router project in TypeScript.
- [ ] The Collection module exposes the Overview model. A server component reads it at each request.
- [ ] One environment variable in `.env.local` holds the Collection path. A `.env.example` documents it.
- [ ] A missing or wrong Collection path gives an error page that names the environment variable.
- [ ] The module reads `.md` files in the Collection and all subfolders.
- [ ] The module skips dot-files, dot-folders and files that are not `.md`.
- [ ] The Note date is a valid `YYYY-MM-DD` prefix of the filename. An invalid prefix gives an Undated Note.
- [ ] Day groups are newest first. The Undated group is last. Notes in one group are in filename order.
- [ ] A new or deleted Note shows in the Overview after a browser refresh.
- [ ] Tests call the Overview model against a temporary fixture Collection.
