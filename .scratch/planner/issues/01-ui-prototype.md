# 01 — UI prototype for the Overview and the Note view

**What to build:** A throwaway `/prototype` that decides how the Overview and the Note view look. It covers the day groups, the Undated group, a Note entry with its Note title and Open Todo count, and a rendered Note with headings, a table, code blocks and disabled checkboxes. The result is a decided layout and style that the page tickets follow. Keep the prototype on a `prototype/ui` branch as a primary source.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] The user has seen and agreed a layout for the Overview.
- [x] The user has seen and agreed a layout for the Note view.
- [x] The styling approach is decided, for example Tailwind with a typography style for rendered Markdown.
- [x] The prototype is on a `prototype/ui` branch out of `main`.
- [x] A `## Answer` section in this ticket records the decisions and links the branch.

## Answer

**Primary source:** branch `prototype/ui`, three rounds, one commit each. Run `npm install && npm run dev` on that branch.

- Overview: `/prototype/overview?variant=D`, file `src/app/prototype/overview/_variants.tsx`, `VariantD`.
- Note view: `/prototype/note?variant=A`, file `src/app/prototype/note/_variants.tsx`, `VariantA`.

The prototype code is throwaway. Rewrite it properly in tickets 02 to 05, and do not copy it.

### Styling approach

- Tailwind CSS 4 with the `@tailwindcss/typography` plugin. The rendered Note content uses `prose`.
- Light and dark mode follow the system setting.

### Overview: "Bold day bands"

The user compared six variants in two rounds and chose this one. It has these parts:

- **Summary header**: A violet gradient band (`from-violet-600 to-indigo-700`) at the top. It shows today's full date, the total count of Open Todos in large bold text ("31 open todos"), and "across N of M notes".
- **Page**: A light grey background (`neutral-50`, dark `neutral-950`) and a centred column (`max-w-3xl`).
- **Month separators**: A small uppercase month label ("September 2026") before the first day of each month.
- **Day bands**: A full-width band per Note date that stays at the top while you scroll. It shows the relative day in bold ("Today", "Yesterday", "3 days ago"), the short date, and the count of Notes. The Undated group has a darker band with the label "Undated".
- **Note cards**: One white card per Note (`rounded-xl`, border, small shadow, lifts on hover). Each card has three parts:
  - **Progress ring** on the left. It shows the Open Todo count in violet, a green ✓ when all Todos are done, and an empty ring when the Note has no Todos.
  - **Note title** in bold.
  - **Folder badge** on the right, with a colour per top-level folder. A Note at the Collection root has no badge.
- Undated Note cards have a dashed border.

### Note view: "Gradient hero"

The user compared four variants in the Bold day bands style and chose this one. The "More from today" block was tried and rejected.

- **Hero**: A violet gradient header, the same gradient as the Overview header. It has three parts:
  - **Back link**: "← All notes".
  - **Date and title**: the relative day and the full date ("Today · Tuesday 29 September 2026"), then the Note title in large bold text. An Undated Note shows "Undated".
  - **Todo box**: a translucent box on the right with the progress ring and "N open of M todos". The box does not show when the Note has no Todos.
- **Content card**: One white card (`rounded-xl`, border, shadow) that overlaps the bottom of the hero. At the top of the card are the folder badge and the Note path in small monospace text, for example `work/2026-09-29-standup.md`. Below that is the rendered content in `prose`.
- **Links**: Links in the content use the violet accent.
- **Task lists**: Task-list items have no bullets, nested items are indented, and the checkboxes are disabled.

### Rejected

- **Overview round 1**: Dense table and Month calendar.
- **Overview round 2**: Paper journal and Compact mono. The plain Timeline was the starting point for this round.
- **Note view round 1**: Reading column, Meta sidebar, and Split with note list. They were not in the chosen style.
- **Note view round 3**: Content card + todo rail, Day band + more from today, and the combination with "More from today".
