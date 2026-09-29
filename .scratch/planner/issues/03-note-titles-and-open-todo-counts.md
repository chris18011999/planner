# 03 — Note titles and Open Todo counts in the Overview

**What to build:** The Overview shows the Note title of each Note in place of its filename. It also shows the Open Todo count of each Note, so that I can see which Notes still need work.

**Blocked by:** 02 — Overview tracer bullet: Notes grouped per day.

**Status:** done

- [x] The Note title is the first `# ` heading in the body after the frontmatter.
- [x] A Note with no `# ` heading uses its filename without `.md` as its Note title. The date prefix stays.
- [x] The Open Todo count includes unchecked task-list items at all nesting levels.
- [x] Checked items and checkboxes inside code blocks do not count.
- [x] The Overview shows the count as the design from ticket 01 specifies.
- [x] Tests call the Overview model to check titles and counts against fixture Notes.

## Comments

**Implementation decisions to confirm:**

- The Overview model also gives the count of all Todos per Note. The progress ring needs it to show the done share and the green ✓.
- The Note title comes only from a `# ` heading at the top level of the body. A heading inside a list item or a block quote does not count.
- A setext heading also counts as a `# ` heading. A setext heading is a line with `===` below it. Markdown treats both as a level-1 heading.
- An empty `# ` heading does not give a Note title. The module uses the next `# ` heading, or else the filename.
- The Note title is plain text. The module removes inline formatting, for example `*standup*` becomes `standup`.
- Todos in ordered lists and in block quotes count.
- `- [X]` with a capital X counts as a checked Todo, as in GFM.
- A `- [ ]` with no text after it is not a Todo. GFM does not treat it as a task-list item.
- The Note title does not include inline HTML or image alt text.
- The Overview skips a Note that disappears while the app reads the Collection. Some editors save through a temporary file, and this can happen then.
- The frontmatter can be YAML (`---`) or TOML (`+++`).
