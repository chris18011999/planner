# 04 — Note view with rendered Markdown

**What to build:** I click a Note in the Overview, and its Note view opens at `/notes/<Note path>`. The Note view shows the Note content as GitHub-flavoured Markdown. It has a link back to the Overview. A URL that does not match a Note shows a "not found" page. The page follows the design from ticket 01.

**Blocked by:** 02 — Overview tracer bullet: Notes grouped per day.

**Status:** done

- [x] The Collection module exposes Note by path.
- [x] The Note path is the path relative to the Collection without `.md`. Notes with the same filename in different subfolders have different URLs.
- [x] Each Overview entry links to its Note view.
- [x] Rendering supports GFM tables, code blocks and task lists.
- [x] The frontmatter does not show.
- [x] Checkboxes show their state and are disabled.
- [x] A path that is not a Note, or that resolves outside the Collection, gives "not found".
- [x] A change to a Note shows in the Note view after a browser refresh.
- [x] Tests call Note by path against fixture Notes, including path-escape attempts such as `../`.

## Comments

**Implementation decisions:**

- Note by path accepts only a path that the Overview can give. It rejects dot segments, dot-files, symbolic links and a case that differs from the file on disk.
- Next.js 16 passes the catch-all segments still percent-encoded. The Note view page decodes each segment.
- The renderer drops raw HTML in a Note. This is the default of `remark-rehype`.
- The renderer does not remove `javascript:` URLs from links. Ticket 05 rewrites links and must handle them.

