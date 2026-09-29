# Planner

A read-only view of a personal collection of Markdown notes and the todos inside them.

## Language

**Collection**:
The one folder, and all of its subfolders, that holds the Notes.
_Avoid_: Vault, library, workspace, notes folder

**Note**:
One Markdown file in the Collection. It is the only kind of file that the Overview lists.
_Avoid_: Document, entry, page, file

**Asset**:
An image file in the Collection that a Note shows. The app serves it at its asset URL.
_Avoid_: Attachment, media, upload

**Note title**:
The first `# ` heading of a Note, or its filename when the Note has no such heading.
_Avoid_: Name, subject

**Todo**:
A Markdown checkbox item (`- [ ]` or `- [x]`) inside a Note. A Todo has no file of its own.
_Avoid_: Task, item, action

**Open Todo**:
A Todo that is not checked (`- [ ]`).
_Avoid_: Pending, incomplete, unfinished

**Note date**:
The date in the filename of a Note, for example `2026-09-29` in `2026-09-29-standup.md`. It is one day.
_Avoid_: Created date, modified date, timestamp

**Undated Note**:
A Note whose filename has no Note date.
_Avoid_: Unsorted, misc

**Overview**:
The view that lists all Notes, grouped per Note date with the newest day first. The Undated Notes form the last group.
_Avoid_: Dashboard, index, home

**Note view**:
The view that shows the content of one Note.
_Avoid_: Detail page, note page
