# Planner

A view of a personal collection of Markdown notes and the todos inside them. The Notes live in Postgres. The app can create a Note, and edit a Note one block at a time. It cannot delete or rename a Note.

## Language

**User**:
A person who signs in with a Google account. Each User has their own Collection.
_Avoid_: Account, member, profile

**Owner**:
The User whose Collection holds a Note or an Asset.
_Avoid_: Author, creator

**Collection**:
All Notes and Assets of one User. The Notes keep a folder structure in their Note paths.
_Avoid_: Vault, library, workspace, notes folder

**Note**:
One Markdown document in the Collection, with its Note path. It is the only kind of item that the Overview lists.
_Avoid_: Document, entry, page, file

**Asset**:
An image in the Collection that a Note shows. It has an Asset path, for example `work/images/diagram.png`. The app serves it at its asset URL.
_Avoid_: Attachment, media, upload

**Note path**:
The path of a Note in the Collection, without `.md`, for example `work/2026-09-29-standup`. One Owner has one Note for each Note path.
_Avoid_: Slug, id, filename

**Note title**:
The first `# ` heading of a Note, or the last segment of its Note path when the Note has no such heading.
_Avoid_: Name, subject

**Todo**:
A Markdown checkbox item (`- [ ]` or `- [x]`) inside a Note. A Todo has no row of its own.
_Avoid_: Task, item, action

**Open Todo**:
A Todo that is not checked (`- [ ]`).
_Avoid_: Pending, incomplete, unfinished

**Note date**:
The date at the start of the last segment of the Note path, for example `2026-09-29` in `work/2026-09-29-standup`. It is one day.
_Avoid_: Created date, modified date, timestamp

**Undated Note**:
A Note whose Note path has no Note date.
_Avoid_: Unsorted, misc

**New Note form**:
The form at `/new` that creates a Note in the Collection root. The Note path is the Note date of today, a `-` and a slug of the Note title.
_Avoid_: Editor, compose page

**Overview**:
The view that lists all Notes, grouped per Note date with the newest day first. The Undated Notes form the last group.
_Avoid_: Dashboard, index, home

**Note view**:
The view that shows the content of one Note. A click on a block opens it for editing.
_Avoid_: Detail page, note page

**Block**:
One top-level element of a Note, or one top-level list item with its nested items. The Note view edits one block at a time.
_Avoid_: Section, paragraph, chunk

**Version**:
The SHA-256 hash of the Markdown of a Note, with its frontmatter. A save with an old version fails with "changed on disk".
_Avoid_: Revision, timestamp, etag

**Import**:
The one-time copy of a folder of Markdown files and images into the Collection of a User. It creates only.
_Avoid_: Sync, upload

**Export**:
The copy of the Collection of a User back to a folder of Markdown files and images.
_Avoid_: Backup, download
