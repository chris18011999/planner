# 1. The app creates Notes

Status: accepted, 2026-09-29

## Context

Version 1 of Planner was a read-only view of the Collection. The spec listed the creation of Notes in the browser as out of scope. I want to start a Note from the Overview, without a switch to my editor.

## Decision

The app can create a Note. This is its only write to disk. Editing, deleting and ticking Todos stay out of scope.

- The Collection module owns the write, as Create Note. The Server Action of the New Note form only calls it.
- A new Note is always in the Collection root. Its filename is the Note date of today, a `-` and a slug of the Note title. The slug has only `a-z`, `0-9` and `-`. So the title cannot choose a folder or a dot-file.
- Create Note opens the file with the `wx` flag. An existing file stays unchanged, and the form shows an error. The app does not add a number to the filename.
- The file has a `# ` heading with the Note title and the body. It has no frontmatter, so the Note stays a plain Markdown file for my editor.

## Consequences

- The app now changes the Collection. A bug in Create Note can add unwanted files, but it cannot change or remove a file, because of `wx`.
- The app does not bind to `127.0.0.1` and has no `Host` check, because I can publish the app later. Other devices on the network can create Notes. They cannot overwrite a file. This is an accepted risk until a later ticket adds authentication.
- On a case-sensitive disk, a filename that differs only in case can exist next to a new Note.
