# Spec: Planner version 1

Status: ready-for-agent

## Problem Statement

I keep my notes and todos as Markdown files in a folder. I edit them in my own editor. I have no single place that shows all my Notes by day, or that tells me which Notes still have Open Todos. To find a Note, I must look through the folder by hand.

## Solution

Planner is a web app. Since ticket 11, it keeps my Collection in Postgres, and each User has their own Collection. See `docs/adr/0004-postgres-is-the-source-of-truth.md`. Before ticket 11, it read the Collection from disk at each page load. The Overview lists all Notes, grouped per Note date, with the newest day first. Each Note shows its Note title and its count of Open Todos. When I click a Note, the Note view shows its rendered content. Links to other Notes and images in the Collection work. Before ticket 11, a browser refresh showed a change from my editor. Since ticket 06, I can also create a Note in the browser. Since ticket 07, I can edit a Note in the Note view, one block at a time, and tick a Todo. See `docs/adr/0001-the-app-creates-notes.md` and `docs/adr/0002-the-app-edits-notes.md`.

## User Stories

Ticket 11 retires stories 1 to 5, 8, 29 and 31. They describe the folder on disk and my own editor. `npm run import` and `npm run export` replace them.


1. As the user, I want to set the Collection folder in an environment file, so that the app reads my Notes from the place where I keep them.
2. As the user, I want the app to read all `.md` files in the Collection and its subfolders, so that my folder structure does not limit me.
3. As the user, I want the app to ignore dot-files and dot-folders, such as `.git` and `.obsidian`, so that tool data does not show as Notes.
4. As the user, I want the app to ignore files that are not `.md`, so that only Notes show in the Overview.
5. As the user, I want to open the app on `localhost`, so that I can use it without a server or an account.
6. As the user, I want the Overview to group Notes per Note date, so that I can see what I wrote on each day.
7. As the user, I want the newest day first in the Overview, so that my recent Notes are at the top.
8. As the user, I want the app to take the Note date from the start of the filename, for example `2026-09-29-standup.md`, so that the date stays correct when I copy or sync files.
9. As the user, I want Notes with the same Note date in alphabetical filename order, so that the order is predictable and under my control.
10. As the user, I want Undated Notes in a last group, so that no Note disappears from the Overview.
11. As the user, I want to see the Note title of each Note in the Overview, so that I can identify it quickly.
12. As the user, I want the Note title to be the first `# ` heading of the Note, so that the Overview shows the name that I gave in the text.
13. As the user, I want the filename as the Note title when a Note has no `# ` heading, so that each Note has a title.
14. As the user, I want to see the count of Open Todos for each Note in the Overview, so that I know which Notes still need work.
15. As the user, I want nested unchecked checkboxes to count as Open Todos, so that the count includes sub-todos.
16. As the user, I want checkboxes inside code blocks not to count, so that example code does not change the count.
17. As the user, I want checked Todos (`- [x]`) not to count, so that the count shows only remaining work.
18. As the user, I want a Note with zero Open Todos to show no count or a zero count, so that I can see that it needs no work.
19. As the user, I want to click a Note in the Overview to open its Note view, so that I can read its full content.
20. As the user, I want the URL of a Note view to be the path of the Note relative to the Collection, so that the URL is readable and two Notes with the same filename in different subfolders do not collide.
21. As the user, I want the Note view to render GitHub-flavoured Markdown, including tables, code blocks and checkboxes, so that the Note looks as it does on GitHub.
22. As the user, I want to tick a Todo in the Note view with one click, so that I can mark work as done without my editor. Ticket 07 replaced the disabled checkboxes.
23. As the user, I want the frontmatter of a Note hidden in the Note view, so that metadata does not clutter the content.
24. As the user, I want a relative link to another Note to open that Note's Note view, so that I can move between related Notes.
25. As the user, I want external links to stay unchanged, so that they open the external site.
26. As the user, I want images that a Note references from the Collection to show in the Note view, so that diagrams and screenshots are visible.
27. As the user, I want the app to serve only files inside the Collection, so that a URL cannot read other files on my Mac.
28. As the user, I want a "not found" page for a URL that does not match a Note, so that a broken link gives a clear result.
29. As the user, I want a browser refresh to show my latest edits, so that I do not need to restart the app.
30. As the user, I want a new Note to appear in the Overview after a refresh, so that I can see what I just wrote.
31. As the user, I want a deleted Note to disappear from the Overview after a refresh, so that the Overview matches the Collection.
32. As the user, I want a link back to the Overview from each Note view, so that I can return to the list.

## Implementation Decisions

- **Stack**: Next.js with the App Router and TypeScript. Server components read the Collection from Postgres at each request, through Drizzle ORM and the `postgres` driver. The app has no API layer.
- **Configuration**: `DATABASE_URL` in `.env.local` gives the connection. `OWNER_EMAIL` gives the one User until ticket 09 ships. `compose.yaml` starts a local Postgres, with `POSTGRES_PASSWORD` from `.env.local`.
- **Database**: The tables are `user`, in the Better Auth shape, and `notes`. Each Note has an owner id. The owner id and the Note path together are unique. Drizzle Kit owns the migrations in `drizzle/`. `npm run db:migrate` runs them and creates the User of `OWNER_EMAIL`.
- **Import and export**: `npm run import -- <folder> --owner <email>` copies the `.md` files of a folder into the Collection. It skips images, because the app stores no Assets for now. It skips dot-files, dot-folders and symbolic links. It creates only, and it lists each path that exists. `--dry-run` lists what it would create. `npm run export -- <folder> --owner <email>` writes the Collection back to an empty folder.
- **Collection module**: One deep module owns all knowledge of the Collection. The Next.js pages only call it and render its result. Each operation takes the owner id, and every query filters on it. Its interface has four operations:
  - **Overview model**: It takes the owner id. It returns the day groups, newest Note date first, with the Undated Notes as the last group. Each group holds its Notes in filename order. Each Note has its Note title, its Note path and its Open Todo count. The Overview reads these values from columns that each write computes.
  - **Note by path**: It takes a Note path. It returns the Note title, the Note content rendered to HTML, the version of the Note and its blocks. Each block has its character range, its Markdown and its HTML. For a path that is not a Note of the Owner, it returns "not found".
  - **Create Note**: It takes the Note title, the body and the Note date. It creates a new Note in the Collection root and returns its Note path. It returns "exists" or "invalid title" on failure. The unique index stops an overwrite. Ticket 06 gives the rules.
  - **Update Note**: It takes the Note path, the version that the page loaded, the character range of a block and the new Markdown of that block. It replaces only that range and returns the new version. The `UPDATE` checks the version itself, so the check and the write are one step. It returns "not found" or "changed on disk" on failure. Ticket 07 gives the rules.
- **Note path**: The path of a Note in the Collection, without the `.md` extension, for example `work/2026-09-29-standup`. The Note view URL is `/notes/` followed by the Note path.
- **Note date**: A `YYYY-MM-DD` prefix at the start of the last segment of the Note path. The Note date is one day.
- **Note title**: The first `# ` heading in the body after the frontmatter. When the Note has no such heading, the Note title is the last segment of the Note path.
- **Open Todo count**: The count of unchecked GFM task-list items at all nesting levels. The count comes from the parsed Markdown tree, so a checkbox inside a code block does not count.
- **Markdown rendering**: GitHub-flavoured Markdown. The renderer strips the frontmatter. Each task-list checkbox gives the offset of its mark in the file, so a click can tick it.
- **Block editing**: A block is one top-level element, or one top-level list item. A click opens it as a text field with its Markdown source. It saves on blur and after 2 seconds without typing. The version check refuses a save after a change in another tab.
- **Network**: The app binds to `127.0.0.1` in `dev` and in `start`.
- **Link rewriting**: The renderer resolves a relative link to a `.md` file against the folder of the current Note, and rewrites it to that Note's Note view URL. It rewrites a relative image source to the asset URL. Since ticket 11, no route serves that URL, so the image does not load. It does not change external links. It prefixes anchor links and heading ids with `user-content-`, as GitHub does.
- **Owner isolation**: No operation can read or change a Note of another User.
- **Skipped files**: The import skips dot-files and dot-folders at every level. It treats only `.md` files as Notes.

## Testing Decisions

- A good test checks external behaviour through the Collection module interface. It does not check internal helpers, parser details or HTML structure beyond what the user sees.
- The tests run the Collection module against a real Postgres. Each test file gets its own database, and each test starts with empty tables. The import and export tests also use a temporary folder.
- The tests cover the day grouping and its order, the Undated group, the filename order in one day, the Note title fallback, the Open Todo count with nested items and code blocks, the link rewriting, the disabled checkboxes, the hidden frontmatter, the owner isolation, the version check in the `UPDATE`, and the import and export round trip.
- The Next.js pages have no tests of their own. Version 1 has no browser end-to-end tests.
- The repo is empty, so there is no prior art for tests.

## Out of Scope

- Deleting or renaming Notes in the browser. Ticket 06 moved the creation of a Note into scope, and ticket 07 moved editing and ticking Todos into scope.
- Hosting. Ticket 09 adds authentication, and ticket 13 hosts the app. More than one User is in scope since ticket 11.
- Automatic page updates from a file watcher.
- A Note date from frontmatter or from file-system times.
- Grouping per week or per month.
- Obsidian-style `[[wiki links]]` and embeds.
- Search, filters and tags.
- A separate view that lists all Todos across Notes.

## Further Notes

- **The look of the UI is decided.** Ticket 01 records it: "Bold day bands" for the Overview and "Gradient hero" for the Note view, built with Tailwind CSS and its typography plugin. The prototype is on the `prototype/ui` branch.
- **Assumptions to confirm**:
  - A filename with an invalid date prefix, for example `2026-13-40-x.md`, gives an Undated Note.
  - The Note title fallback keeps the date prefix of the filename.
