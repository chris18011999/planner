import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CollectionPathError, getOverview } from "./collection";

let collection: string;

beforeEach(async () => {
  collection = await mkdtemp(join(tmpdir(), "planner-collection-"));
});

afterEach(async () => {
  await rm(collection, { recursive: true, force: true });
});

async function addFile(path: string, content = "") {
  const file = join(collection, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function locations() {
  const groups = await getOverview(collection);
  return groups.map(({ date, notes }) => ({
    date,
    notes: notes.map(({ path, filename }) => ({ path, filename })),
  }));
}

async function onlyNote() {
  const [{ notes }] = await getOverview(collection);
  return notes[0];
}

describe("getOverview", () => {
  it("puts a dated Note in the group of its Note date", async () => {
    await addFile("2026-09-29-standup.md");

    expect(await locations()).toEqual([
      {
        date: "2026-09-29",
        notes: [{ path: "2026-09-29-standup", filename: "2026-09-29-standup.md" }],
      },
    ]);
  });

  it("reads Notes in all subfolders, with the Note path relative to the Collection", async () => {
    await addFile("work/deep/2026-09-29-retro.md");

    expect(await locations()).toEqual([
      {
        date: "2026-09-29",
        notes: [{ path: "work/deep/2026-09-29-retro", filename: "2026-09-29-retro.md" }],
      },
    ]);
  });

  it("groups Notes per Note date, newest day first, in filename order in one day", async () => {
    await addFile("2026-09-28-weekend.md");
    await addFile("work/2026-09-29-standup.md");
    await addFile("2026-09-29-groceries.md");
    await addFile("reading/2026-09-29-book.md");
    await addFile("2025-12-31-year-end.md");

    expect(await locations()).toEqual([
      {
        date: "2026-09-29",
        notes: [
          { path: "reading/2026-09-29-book", filename: "2026-09-29-book.md" },
          { path: "2026-09-29-groceries", filename: "2026-09-29-groceries.md" },
          { path: "work/2026-09-29-standup", filename: "2026-09-29-standup.md" },
        ],
      },
      {
        date: "2026-09-28",
        notes: [{ path: "2026-09-28-weekend", filename: "2026-09-28-weekend.md" }],
      },
      {
        date: "2025-12-31",
        notes: [{ path: "2025-12-31-year-end", filename: "2025-12-31-year-end.md" }],
      },
    ]);
  });

  it("puts Notes without a valid Note date in a last Undated group, in filename order", async () => {
    await addFile("ideas.md");
    await addFile("2026-13-40-bad-month.md");
    await addFile("2026-02-30-no-such-day.md");
    await addFile("2026-09-291-too-many-digits.md");
    await addFile("2024-02-29-leap-day.md");
    await addFile("2026-09-29.md");
    await addFile("reading/Books.md");

    expect(await locations()).toEqual([
      {
        date: "2026-09-29",
        notes: [{ path: "2026-09-29", filename: "2026-09-29.md" }],
      },
      {
        date: "2024-02-29",
        notes: [{ path: "2024-02-29-leap-day", filename: "2024-02-29-leap-day.md" }],
      },
      {
        date: null,
        notes: [
          { path: "2026-02-30-no-such-day", filename: "2026-02-30-no-such-day.md" },
          { path: "2026-09-291-too-many-digits", filename: "2026-09-291-too-many-digits.md" },
          { path: "2026-13-40-bad-month", filename: "2026-13-40-bad-month.md" },
          { path: "reading/Books", filename: "Books.md" },
          { path: "ideas", filename: "ideas.md" },
        ],
      },
    ]);
  });

  it("skips dot-files, dot-folders and files that are not .md", async () => {
    await addFile("2026-09-29-standup.md");
    await addFile(".2026-09-29-hidden.md");
    await addFile(".obsidian/2026-09-29-workspace.md");
    await addFile("work/.git/2026-09-29-head.md");
    await addFile("2026-09-29-diagram.png");
    await addFile("2026-09-29-draft.markdown");

    expect(await locations()).toEqual([
      {
        date: "2026-09-29",
        notes: [{ path: "2026-09-29-standup", filename: "2026-09-29-standup.md" }],
      },
    ]);
  });

  it.each([
    ["not set", () => undefined],
    ["empty", () => ""],
    ["relative", () => "notes"],
    ["missing", () => join(collection, "missing")],
    ["a file", () => join(collection, "2026-09-29-standup.md")],
  ])("rejects a Collection path that is %s", async (_, collectionPath) => {
    await addFile("2026-09-29-standup.md");

    await expect(getOverview(collectionPath())).rejects.toThrow(CollectionPathError);
  });

  it("shows a new Note and drops a deleted Note at the next call", async () => {
    await addFile("2026-09-28-old.md");
    await getOverview(collection);

    await addFile("2026-09-29-new.md");
    await unlink(join(collection, "2026-09-28-old.md"));

    expect(await locations()).toEqual([
      {
        date: "2026-09-29",
        notes: [{ path: "2026-09-29-new", filename: "2026-09-29-new.md" }],
      },
    ]);
  });

  describe("Note title", () => {
    it("is the text of the first # heading after the frontmatter", async () => {
      await addFile(
        "2026-09-29-standup.md",
        ["---", "title: Not this", "---", "", "Intro text.", "", "## Agenda", "", "# Daily *standup*", "", "# Second"].join("\n"),
      );

      expect((await onlyNote()).title).toBe("Daily standup");
    });

    it("falls back to the filename without .md and keeps the date prefix", async () => {
      await addFile("work/2026-09-29-standup.md", "## Only a sub-heading\n\nSome text.");

      expect((await onlyNote()).title).toBe("2026-09-29-standup");
    });

    it("ignores a # line inside a code block or the frontmatter", async () => {
      await addFile("ideas.md", ["---", "# not: a heading", "---", "```sh", "# a shell comment", "```"].join("\n"));

      expect((await onlyNote()).title).toBe("ideas");
    });

    it("skips an empty # heading and a # heading inside a list or a block quote", async () => {
      await addFile("ideas.md", ["#", "", "- # In a list", "", "> # In a quote", "", "Real title", "==="].join("\n"));

      expect((await onlyNote()).title).toBe("Real title");
    });

    it("drops inline HTML and image alt text, and skips TOML frontmatter", async () => {
      await addFile("ideas.md", ["+++", "title = 'x'", "+++", "# Plan <b>B</b> ![logo](logo.png) `v2`"].join("\n"));

      expect((await onlyNote()).title).toBe("Plan B v2");
    });
  });

  describe("Open Todo count", () => {
    it("counts Open Todos at all nesting levels, and all Todos", async () => {
      await addFile(
        "2026-09-29-standup.md",
        [
          "- [ ] Top open",
          "- [x] Top done",
          "  - [ ] Nested open",
          "    - [ ] Deeper open",
          "    - [X] Deeper done",
          "- A plain item",
          "",
          "1. [ ] Numbered open",
          "",
          "> - [ ] Quoted open",
        ].join("\n"),
      );

      expect(await onlyNote()).toMatchObject({ openTodoCount: 5, todoCount: 7 });
    });

    it("skips checkboxes inside code blocks", async () => {
      await addFile(
        "2026-09-29-standup.md",
        ["- [ ] Real", "", "```md", "- [ ] Example", "- [x] Example", "```", "", "    - [ ] Indented code"].join("\n"),
      );

      expect(await onlyNote()).toMatchObject({ openTodoCount: 1, todoCount: 1 });
    });

    it("is zero for a Note without Todos", async () => {
      await addFile("2026-09-29-standup.md", "# Standup\n\n- Just a list");

      expect(await onlyNote()).toMatchObject({ openTodoCount: 0, todoCount: 0 });
    });
  });
});
