# 06 — Create a Note from the browser

**What to build:** I click "New note" in the Overview header. A form asks for a Note title and an optional body. When I submit it, the app writes a new Note to the Collection and opens its Note view. The app never overwrites a file.

**Blocked by:** 05 — Links and images inside a Note.

**Status:** done

- [x] The Collection module exposes Create Note. It takes the Note title, the body and the Note date, and it gives the Note path or a reason for failure.
- [x] The filename is the Note date, a `-` and a slug of the Note title, for example `2026-09-29-weekly-review.md`.
- [x] The slug has only `a-z`, `0-9` and `-`, and at most 60 characters. Diacritics become plain letters. A title that gives an empty slug gives "invalid title".
- [x] The new Note is in the Collection root. The app creates no folders.
- [x] The file content is `# <Note title>`, an empty line and the body. The file has no frontmatter.
- [x] Create Note opens the file with the `wx` flag. An existing file stays unchanged and gives "exists".
- [x] The form is at `/new`. A "New note" button in the Overview header links to it.
- [x] On "exists", the form shows "A Note with this name already exists". On "invalid title", it shows "The Note title needs at least one letter or digit". The form keeps the input.
- [x] After a successful create, the app redirects to the Note view of the new Note.
- [x] A Server Action handles the form. It gives the Collection module the local date from `localToday()`.
- [x] Tests call Create Note against a fixture Collection. They check the filename, the content, the slug rules, "exists", and a title such as `../../etc/x` or `.hidden`.
- [x] Tests check that the new Note shows in the Overview model and in Note by path.
- [x] The spec, CONTEXT.md and a first ADR record that the app is no longer read-only.

## Comments

**Why it changes the product:** The spec calls Planner "a local, read-only web app". It lists "Creating ... Notes in the browser" as out of scope. This ticket makes the app write to disk for the first time. Editing, deleting and ticking Todos stay out of scope.

**Why the form is at `/new`:** The route `/notes/new` would take precedence over the Note view catch-all. A root Note named `new.md` would then have no Note view.

**Implementation decisions, confirmed by the user:**

- A new Note is always in the Collection root. A folder choice can come in a later ticket.
- The Note date is always today. The form has no date field.
- A collision shows the "exists" error. The app does not add a number such as `-2`.
- The slug applies NFKD and removes the combining marks. It maps `ß→ss`, `æ→ae`, `ø→o`, `œ→oe` and `ł→l`.
- The slug changes each run of other characters to one `-`, and removes the `-` at the start and the end.
- The slug is cut at 60 characters, at the last `-` before the limit when one exists. A trailing `-` is then removed.
- A title without Latin letters or digits, for example `会議` or `🎉`, gives "invalid title". There is no fallback slug.
- The app trims the whitespace at the start and the end of the title. A title that contains a newline gives "invalid title".
- The body gets LF line endings and one final newline. With an empty body, the file is `# <Note title>` and a newline.
- Create Note relies on `wx` only. On a case-sensitive disk, a name that differs only in case can exist next to the new Note.
- A missing Collection gives the existing `CollectionPathError` page. Create Note throws all other errors, for example a folder that is not writable. The Next.js error page shows them.
- The form has a "← All notes" link. The "New note" button is only in the Overview header.
- The app does not bind to `127.0.0.1` and has no `Host` check, because the app can be published later. Other devices on the network can create Notes, but they cannot overwrite a file. The ADR records this as an accepted risk until a later ticket adds authentication.
