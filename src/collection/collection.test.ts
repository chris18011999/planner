import { mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CollectionPathError, getNote, getOverview } from "./collection";

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

describe("getNote", () => {
  it("gives the Note title and the Note content as HTML for a Note path", async () => {
    await addFile("work/2026-09-29-standup.md", "# Standup\n\nSome *text*.");

    expect(await getNote(collection, "work/2026-09-29-standup")).toMatchObject({
      path: "work/2026-09-29-standup",
      filename: "2026-09-29-standup.md",
      date: "2026-09-29",
      title: "Standup",
      html: "<h1>Standup</h1>\n<p>Some <em>text</em>.</p>",
    });
  });

  it("renders GFM tables, code blocks and task lists", async () => {
    await addFile(
      "ideas.md",
      ["| Day | Plan |", "| --- | :-: |", "| Mon | Gym |", "", "```ts", "const a = 1 < 2;", "```"].join("\n"),
    );

    const html = (await getNote(collection, "ideas"))?.html ?? "";

    expect(html).toContain("<table>");
    expect(html).toMatch(/<th[^>]*>Plan<\/th>/);
    expect(html).toMatch(/<td[^>]*>Gym<\/td>/);
    expect(html).toMatch(/<pre><code class="language-ts">const a = 1 (&lt;|&#x3C;) 2;/);
  });

  it("shows the state of each checkbox and disables it", async () => {
    await addFile("ideas.md", ["- [ ] Open", "- [x] Done", "  - [ ] Nested"].join("\n"));

    const html = (await getNote(collection, "ideas"))?.html ?? "";

    expect(html.match(/<input[^>]*>/g)).toEqual([
      '<input type="checkbox" disabled>',
      '<input type="checkbox" checked disabled>',
      '<input type="checkbox" disabled>',
    ]);
  });

  it("does not show YAML or TOML frontmatter", async () => {
    await addFile("yaml.md", ["---", "title: Hidden", "---", "Body"].join("\n"));
    await addFile("toml.md", ["+++", "title = 'Hidden'", "+++", "Body"].join("\n"));

    expect((await getNote(collection, "yaml"))?.html).toBe("<p>Body</p>");
    expect((await getNote(collection, "toml"))?.html).toBe("<p>Body</p>");
  });

  it("gives the Todo counts, and no Note date for an Undated Note", async () => {
    await addFile("ideas.md", ["- [ ] Open", "- [x] Done"].join("\n"));

    expect(await getNote(collection, "ideas")).toMatchObject({ date: null, openTodoCount: 1, todoCount: 2 });
  });

  it("shows a change to a Note at the next call", async () => {
    await addFile("ideas.md", "Before");
    await getNote(collection, "ideas");

    await addFile("ideas.md", "After");

    expect((await getNote(collection, "ideas"))?.html).toBe("<p>After</p>");
  });

  it.each([
    ["a missing Note", "work/2026-09-30-missing"],
    ["a folder", "work"],
    ["a folder with a .md name", "archive"],
    ["a file that is not .md", "work/diagram.png"],
    ["the .md extension", "work/2026-09-29-standup.md"],
    ["an empty path", ""],
    ["a trailing slash", "work/2026-09-29-standup/"],
    ["a Note in a dot-folder", ".obsidian/2026-09-29-workspace"],
    ["a dot-file Note", "work/.2026-09-29-hidden"],
    ["a parent segment that leaves the Collection", "../outside"],
    ["a parent segment inside the path", "work/../../outside"],
    ["a parent segment that stays inside", "work/../work/2026-09-29-standup"],
    ["a current-folder segment", "./work/2026-09-29-standup"],
    ["an absolute path", "/etc/hosts"],
    ["a backslash", "work\\2026-09-29-standup"],
    ["a null byte", "work/2026-09-29-standup\0"],
  ])("gives not found for %s", async (_, notePath) => {
    await addFile("notes/work/2026-09-29-standup.md", "# Standup");
    await addFile("notes/work/diagram.png");
    await addFile("notes/archive.md/2026-09-29-old.md");
    await addFile("notes/.obsidian/2026-09-29-workspace.md");
    await addFile("notes/work/.2026-09-29-hidden.md");
    await addFile("outside.md", "# Outside");

    expect(await getNote(join(collection, "notes"), notePath)).toBeNull();
  });

  it("gives not found for a symbolic link that leaves the Collection", async () => {
    const outside = await mkdtemp(join(tmpdir(), "planner-outside-"));
    try {
      await writeFile(join(outside, "secret.md"), "# Secret");
      await symlink(join(outside, "secret.md"), join(collection, "secret.md"));
      await symlink(outside, join(collection, "linked"));

      expect(await getNote(collection, "secret")).toBeNull();
      expect(await getNote(collection, "linked/secret")).toBeNull();
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});
