# 04 — Note view with rendered Markdown

**What to build:** I click a Note in the Overview, and its Note view opens at `/notes/<Note path>`. The Note view shows the Note content as GitHub-flavoured Markdown. It has a link back to the Overview. A URL that does not match a Note shows a "not found" page. The page follows the design from ticket 01.

**Blocked by:** 02 — Overview tracer bullet: Notes grouped per day.

**Status:** ready-for-agent

- [ ] The Collection module exposes Note by path.
- [ ] The Note path is the path relative to the Collection without `.md`. Notes with the same filename in different subfolders have different URLs.
- [ ] Each Overview entry links to its Note view.
- [ ] Rendering supports GFM tables, code blocks and task lists.
- [ ] The frontmatter does not show.
- [ ] Checkboxes show their state and are disabled.
- [ ] A path that is not a Note, or that resolves outside the Collection, gives "not found".
- [ ] A change to a Note shows in the Note view after a browser refresh.
- [ ] Tests call Note by path against fixture Notes, including path-escape attempts such as `../`.
