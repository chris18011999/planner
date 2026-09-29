# Spec: Planner version 1

Status: ready-for-agent

## Problem Statement

I keep my notes and todos as Markdown files in a folder. I edit them in my own editor. I have no single place that shows all my Notes by day, or that tells me which Notes still have Open Todos. To find a Note, I must look through the folder by hand.

## Solution

Planner is a local, read-only web app. It reads my Collection from disk at each page load. The Overview lists all Notes, grouped per Note date, with the newest day first. Each Note shows its Note title and its count of Open Todos. When I click a Note, the Note view shows its rendered content. Links to other Notes and images in the Collection work. When I change a Note in my editor, a browser refresh shows the change.

## User Stories

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
22. As the user, I want checkboxes in the Note view to show their state but be disabled, so that the read-only app does not suggest that I can tick them.
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

- **Stack**: Next.js with the App Router and TypeScript. Server components read the Collection directly from disk at each request. The app has no database, no API layer and no file watcher.
- **Configuration**: One environment variable in `.env.local` holds the absolute path of the Collection.
- **Collection module**: One deep module owns all knowledge of the Collection. The Next.js pages only call it and render its result. Its interface has three operations:
  - **Overview model**: It takes the Collection path. It returns the day groups, newest Note date first, with the Undated Notes as the last group. Each group holds its Notes in filename order. Each Note has its Note title, its Note path and its Open Todo count.
  - **Note by path**: It takes a Note path. It returns the Note title and the Note content rendered to HTML. For a path that is not a Note, or that resolves outside the Collection, it returns "not found".
  - **Asset by path**: It takes a path. It returns the file content and its media type for an image inside the Collection. For a path outside the Collection, it returns "not found".
- **Note path**: The path of a Note relative to the Collection, without the `.md` extension, for example `work/2026-09-29-standup`. The Note view URL is `/notes/` followed by the Note path.
- **Note date**: A `YYYY-MM-DD` prefix at the start of the filename. The Note date is one day.
- **Note title**: The first `# ` heading in the body after the frontmatter. When the Note has no such heading, the Note title is the filename without the `.md` extension.
- **Open Todo count**: The count of unchecked GFM task-list items at all nesting levels. The count comes from the parsed Markdown tree, so a checkbox inside a code block does not count.
- **Markdown rendering**: GitHub-flavoured Markdown. The renderer strips the frontmatter. Task-list checkboxes render disabled.
- **Link rewriting**: The renderer resolves a relative link to a `.md` file against the folder of the current Note, and rewrites it to that Note's Note view URL. It rewrites a relative image source to the asset URL. It does not change external links or anchor links.
- **Path containment**: The Collection module resolves every requested path and rejects it when it does not stay inside the Collection. This applies to Note by path and to Asset by path.
- **Skipped files**: The module skips dot-files and dot-folders at every level. It treats only `.md` files as Notes.

## Testing Decisions

- A good test checks external behaviour through the Collection module interface. It does not check internal helpers, parser details or HTML structure beyond what the user sees.
- The tests create a temporary Collection folder with fixture Notes, subfolders, dot-folders and images. They then call the three operations.
- The tests cover the day grouping and its order, the Undated group, the filename order in one day, the Note title fallback, the Open Todo count with nested items and code blocks, the link rewriting, the disabled checkboxes, the hidden frontmatter and the path containment for Notes and assets.
- The Next.js pages have no tests of their own. Version 1 has no browser end-to-end tests.
- The repo is empty, so there is no prior art for tests.

## Out of Scope

- Creating, editing or deleting Notes, and ticking Todos, in the browser.
- Hosting, authentication and more than one user.
- Automatic page updates from a file watcher.
- A Note date from frontmatter or from file-system times.
- Grouping per week or per month.
- Obsidian-style `[[wiki links]]` and embeds.
- Search, filters and tags.
- A separate view that lists all Todos across Notes.

## Further Notes

- **Open point: the look of the UI.** The layout and style of the Overview and the Note view are not decided yet. The first ticket is a `/prototype` for this question. The implementation tickets for the pages depend on its result.
- **Assumptions to confirm**:
  - A filename with an invalid date prefix, for example `2026-13-40-x.md`, gives an Undated Note.
  - A missing or wrong Collection path gives a clear error page that names the environment variable.
  - The Note title fallback keeps the date prefix of the filename.
