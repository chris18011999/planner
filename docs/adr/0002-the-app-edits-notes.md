# 2. The app edits Notes and binds to 127.0.0.1

Status: accepted, 2026-09-29. ADR 0004 supersedes the file-based parts.

Supersedes the network part of `0001-the-app-creates-notes.md`.

## Context

ADR 0001 let the app create Notes, but not change them. I want to change a Note and tick a Todo in the Note view, without a switch to my editor. I also edit the Notes in my own editor, so the app must keep my diffs small and clean.

## Decision

The app edits a Note one block at a time.

- A block is one top-level element of the Note. Each top-level list item is a block of its own, with its nested items.
- Note by path gives the version of the Note and the character range of each block. The version is a SHA-256 hash of the file content.
- The Collection module owns the write, as Update Note. It takes the Note path, the version that the page loaded, the range of a block and the new Markdown of that block. It gives the new version, or "not found" or "changed on disk".
- Update Note replaces only the characters of the range. All other bytes stay unchanged, including the frontmatter. A range that touches the frontmatter is an error.
- New Markdown without text removes the block and its blank lines. An empty range at the end of the file adds a block.
- Update Note writes a temporary dot-file in the folder of the Note, and then renames it over the Note. The Overview skips the dot-file.
- On an old version, Update Note refuses the save. It does not merge, and the last save does not win.
- A change to the `# ` heading does not rename the file.

The app binds to `127.0.0.1` in `dev` and in `start`.

## Consequences

- A WYSIWYG editor is not necessary. It turns the page back into Markdown and rewrites the whole file, so list markers, emphasis style and table spacing can change.
- The app can now change and remove text in a Note. It cannot delete or rename a Note.
- A change in my editor between the version check and the rename is lost. The window is short, and I accept this risk.
- Other devices on the network cannot reach the app. ADR 0001 accepted their access, because they could not overwrite a file. Editing removes that guarantee. A later ticket adds authentication before the app goes online.
