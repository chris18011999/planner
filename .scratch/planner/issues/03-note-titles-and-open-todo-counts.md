# 03 — Note titles and Open Todo counts in the Overview

**What to build:** The Overview shows the Note title of each Note in place of its filename. It also shows the Open Todo count of each Note, so that I can see which Notes still need work.

**Blocked by:** 02 — Overview tracer bullet: Notes grouped per day.

**Status:** ready-for-agent

- [ ] The Note title is the first `# ` heading in the body after the frontmatter.
- [ ] A Note with no `# ` heading uses its filename without `.md` as its Note title. The date prefix stays.
- [ ] The Open Todo count includes unchecked task-list items at all nesting levels.
- [ ] Checked items and checkboxes inside code blocks do not count.
- [ ] The Overview shows the count as the design from ticket 01 specifies.
- [ ] Tests call the Overview model to check titles and counts against fixture Notes.
