# 07 — Edit a Note in the Note view

**What to build:** I click a block in the Note view, and it becomes a text field with its Markdown source. I type, and the app saves the change to the file. There is no edit mode. The page works like a live page. I can also tick a Todo with one click.

**Blocked by:** 06 — Create a Note from the browser.

**Status:** done

- [x] The Collection module exposes Update Note. It takes the Note path, the version that the page loaded, the character range of a block and the new Markdown of that block. It gives the new version, or "not found" or "changed on disk".
- [x] Note by path also gives the version of the Note and the character range of each block.
- [x] The version is a SHA-256 hash of the file content.
- [x] Update Note replaces only the characters of the block. All other bytes of the file stay unchanged, including the frontmatter.
- [x] Update Note writes a temporary dot-file in the folder of the Note, and then renames it over the Note.
- [x] A block is one top-level element of the Note. Each top-level list item is a block of its own, with its nested items.
- [x] A click on a block opens it as a text field with its Markdown source, in a monospace font. The field grows with its text.
- [x] A click on a link follows the link. A click on a Todo checkbox ticks or unticks it, and does not open the block.
- [x] A block saves when it loses focus, and after 2 seconds without typing. Escape discards the changes to the open block.
- [x] An empty line inside a block splits it. After the save, the parts render as separate blocks.
- [x] A block with no text is removed at the save.
- [x] A click on the empty area below the last block opens a new block at the end of the Note.
- [x] In a list item, Enter at the end starts a new item with the same marker, for example `- [x] `. Enter on an empty item removes the marker. Shift+Enter adds a plain new line.
- [x] On "changed on disk", the open block keeps its text. A banner shows "This Note changed on disk", with a "Reload" button and a "Copy my text" button. The page makes no more saves until a reload.
- [x] A Note without a body opens with the new block field focused.
- [x] The app binds to `127.0.0.1` in `dev` and in `start`.
- [x] Tests call Update Note against a fixture Collection. They check the replaced range, the unchanged bytes and frontmatter, "changed on disk", "not found", a Todo tick, a split, a removed block and a block added at the end.
- [x] Tests check the containment rules of Note by path for Update Note, for example `..`, dot-files and symbolic links.
- [x] ADR 0002 records that the app edits Notes and binds to `127.0.0.1`. It supersedes the network part of ADR 0001.
- [x] The spec and CONTEXT.md record that the app can edit a Note.

## Comments

**Why block at a time:** A WYSIWYG editor turns the page back into Markdown and rewrites the whole file. List markers, emphasis style and table spacing can then change. I also edit the Notes in my own editor, and I want small, clean diffs there.

**Why the binding changes:** ADR 0001 accepts the network risk, because other devices cannot overwrite a file. Editing removes that guarantee. A later ticket adds authentication before the app goes online.

**Implementation decisions, confirmed by the user:**

- The editing model is one block at a time. There is no WYSIWYG editor and no live preview of the source.
- A block saves on blur and after 2 seconds without typing.
- On a conflict, the app refuses the save. It does not merge, and the last save does not win.
- Ticking a Todo is part of this ticket. It uses the same save and the same version check.
- A change to the `# ` heading does not rename the file. The Note path and the links stay the same.
- The frontmatter stays hidden and cannot be edited in the Note view.
- Browser undo works only inside the open block. The page has no history model.
- A new Note from ticket 06 opens with the new block field focused.

**Technical decisions, taken by the agent:**

- A SHA-256 hash is the version, because a modification time can miss two fast saves.
- The temporary file starts with a `.`, so the Overview skips it.
