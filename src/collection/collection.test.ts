import { createHash } from "node:crypto";
import postgres from "postgres";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { notes } from "../db/schema";
import { setupTestDatabase } from "../db/test-database";
import { ensureUser } from "../db/users";
import { createNote, exportNotes, getAsset, getNote, getOverview, importAsset, importNote, updateNote } from "./collection";

setupTestDatabase();

let owner: string;
let otherOwner: string;

beforeEach(async () => {
  owner = await ensureUser("me@example.com");
  otherOwner = await ensureUser("other@example.com");
});

async function addNote(path: string, markdown = "", ownerId = owner) {
  expect(await importNote(ownerId, path, markdown)).toBe("created");
}

async function addAsset(path: string, content = "", ownerId = owner) {
  expect(await importAsset(ownerId, path, Buffer.from(content))).toBe("created");
}

async function locations() {
  const groups = await getOverview(owner);
  return groups.map(({ date, notes }) => ({
    date,
    notes: notes.map(({ path, filename }) => ({ path, filename })),
  }));
}

async function onlyNote() {
  const [{ notes }] = await getOverview(owner);
  return notes[0];
}

async function content(path: string) {
  return (await exportNotes(owner)).find((note) => note.path === path)?.markdown;
}

async function paths() {
  return (await exportNotes(owner)).map((note) => note.path).sort();
}

describe("getOverview", () => {
  it("puts a dated Note in the group of its Note date", async () => {
    await addNote("2026-09-29-standup");

    expect(await locations()).toEqual([
      {
        date: "2026-09-29",
        notes: [{ path: "2026-09-29-standup", filename: "2026-09-29-standup.md" }],
      },
    ]);
  });

  it("reads Notes in all subfolders, with the Note path relative to the Collection", async () => {
    await addNote("work/deep/2026-09-29-retro");

    expect(await locations()).toEqual([
      {
        date: "2026-09-29",
        notes: [{ path: "work/deep/2026-09-29-retro", filename: "2026-09-29-retro.md" }],
      },
    ]);
  });

  it("groups Notes per Note date, newest day first, in filename order in one day", async () => {
    await addNote("2026-09-28-weekend");
    await addNote("work/2026-09-29-standup");
    await addNote("2026-09-29-groceries");
    await addNote("reading/2026-09-29-book");
    await addNote("2025-12-31-year-end");

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
    await addNote("ideas");
    await addNote("2026-13-40-bad-month");
    await addNote("2026-02-30-no-such-day");
    await addNote("2026-09-291-too-many-digits");
    await addNote("2024-02-29-leap-day");
    await addNote("2026-09-29");
    await addNote("reading/Books");

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

  it("lists only the Notes of the Owner", async () => {
    await addNote("2026-09-29-standup");
    await addNote("2026-09-29-secret", "", otherOwner);
    await addNote("2026-09-29-standup", "# Other standup", otherOwner);

    expect(await getOverview(owner)).toEqual([
      {
        date: "2026-09-29",
        notes: [
          { path: "2026-09-29-standup", filename: "2026-09-29-standup.md", title: "2026-09-29-standup", openTodoCount: 0, todoCount: 0 },
        ],
      },
    ]);
  });

  it("gives no groups for an Owner without Notes", async () => {
    await addNote("2026-09-29-standup", "", otherOwner);

    expect(await getOverview(owner)).toEqual([]);
  });

  it("shows a new Note and drops a deleted Note at the next call", async () => {
    await addNote("2026-09-28-old");
    await getOverview(owner);

    await addNote("2026-09-29-new");
    await db().delete(notes).where(eq(notes.path, "2026-09-28-old"));

    expect(await locations()).toEqual([
      {
        date: "2026-09-29",
        notes: [{ path: "2026-09-29-new", filename: "2026-09-29-new.md" }],
      },
    ]);
  });

  describe("Note title", () => {
    it("is the text of the first # heading after the frontmatter", async () => {
      await addNote(
        "2026-09-29-standup",
        ["---", "title: Not this", "---", "", "Intro text.", "", "## Agenda", "", "# Daily *standup*", "", "# Second"].join("\n"),
      );

      expect((await onlyNote()).title).toBe("Daily standup");
    });

    it("falls back to the filename without .md and keeps the date prefix", async () => {
      await addNote("work/2026-09-29-standup", "## Only a sub-heading\n\nSome text.");

      expect((await onlyNote()).title).toBe("2026-09-29-standup");
    });

    it("ignores a # line inside a code block or the frontmatter", async () => {
      await addNote("ideas", ["---", "# not: a heading", "---", "```sh", "# a shell comment", "```"].join("\n"));

      expect((await onlyNote()).title).toBe("ideas");
    });

    it("skips an empty # heading and a # heading inside a list or a block quote", async () => {
      await addNote("ideas", ["#", "", "- # In a list", "", "> # In a quote", "", "Real title", "==="].join("\n"));

      expect((await onlyNote()).title).toBe("Real title");
    });

    it("drops inline HTML and image alt text, and skips TOML frontmatter", async () => {
      await addNote("ideas", ["+++", "title = 'x'", "+++", "# Plan <b>B</b> ![logo](logo.png) `v2`"].join("\n"));

      expect((await onlyNote()).title).toBe("Plan B v2");
    });
  });

  describe("Open Todo count", () => {
    it("counts Open Todos at all nesting levels, and all Todos", async () => {
      await addNote(
        "2026-09-29-standup",
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
      await addNote(
        "2026-09-29-standup",
        ["- [ ] Real", "", "```md", "- [ ] Example", "- [x] Example", "```", "", "    - [ ] Indented code"].join("\n"),
      );

      expect(await onlyNote()).toMatchObject({ openTodoCount: 1, todoCount: 1 });
    });

    it("is zero for a Note without Todos", async () => {
      await addNote("2026-09-29-standup", "# Standup\n\n- Just a list");

      expect(await onlyNote()).toMatchObject({ openTodoCount: 0, todoCount: 0 });
    });
  });
});

describe("getNote", () => {
  it("gives the Note title and the Note content as HTML for a Note path", async () => {
    await addNote("work/2026-09-29-standup", "# Standup\n\nSome *text*.");

    expect(await getNote(owner, "work/2026-09-29-standup")).toMatchObject({
      path: "work/2026-09-29-standup",
      filename: "2026-09-29-standup.md",
      date: "2026-09-29",
      title: "Standup",
      html: "<h1 id=\"user-content-standup\">Standup</h1>\n<p>Some <em>text</em>.</p>",
    });
  });

  it("renders GFM tables, code blocks and task lists", async () => {
    await addNote(
      "ideas",
      ["| Day | Plan |", "| --- | :-: |", "| Mon | Gym |", "", "```ts", "const a = 1 < 2;", "```"].join("\n"),
    );

    const html = (await getNote(owner, "ideas"))?.html ?? "";

    expect(html).toContain("<table>");
    expect(html).toMatch(/<th[^>]*>Plan<\/th>/);
    expect(html).toMatch(/<td[^>]*>Gym<\/td>/);
    expect(html).toMatch(/<pre><code class="language-ts">const a = 1 (&lt;|&#x3C;) 2;/);
  });

  it("shows the state of each checkbox, with the offset of its mark in the file", async () => {
    await addNote("ideas", ["- [ ] Open", "- [x] Done", "  - [ ] Nested", "", "> 1. [X] Quoted"].join("\n"));

    const html = (await getNote(owner, "ideas"))?.html ?? "";

    expect(html.match(/<input[^>]*>/g)).toEqual([
      '<input type="checkbox" data-offset="3">',
      '<input type="checkbox" checked data-offset="14">',
      '<input type="checkbox" data-offset="27">',
      '<input type="checkbox" checked data-offset="44">',
    ]);
  });

  it("gives the SHA-256 hash of the file content as the version, and the length of the content", async () => {
    await addNote("ideas", "# Ideas\n\nCafé\n");

    expect(await getNote(owner, "ideas")).toMatchObject({
      version: createHash("sha256").update("# Ideas\n\nCafé\n").digest("hex"),
      length: 14,
    });
  });

  it("gives each top-level element as a block, with its character range, Markdown and HTML", async () => {
    await addNote("ideas", ["---", "tags: x", "---", "# Ideas", "", "Some *text*.", "", "```", "code", "```"].join("\n"));

    expect((await getNote(owner, "ideas"))?.blocks).toEqual([
      { start: 16, end: 23, markdown: "# Ideas", html: '<h1 id="user-content-ideas">Ideas</h1>' },
      { start: 25, end: 37, markdown: "Some *text*.", html: "<p>Some <em>text</em>.</p>" },
      { start: 39, end: 51, markdown: "```\ncode\n```", html: "<pre><code>code\n</code></pre>" },
    ]);
  });

  it("gives each top-level list item as a block with its nested items, and keeps the list number", async () => {
    await addNote("ideas", ["- [ ] One", "  - Nested", "- Two", "", "3. Three", "4. Four"].join("\n"));

    const blocks = (await getNote(owner, "ideas"))?.blocks ?? [];

    expect(blocks.map(({ markdown }) => markdown)).toEqual(["- [ ] One\n  - Nested", "- Two", "3. Three", "4. Four"]);
    expect(blocks[0].html).toMatch(/^<ul class="contains-task-list">\n<li class="task-list-item">[\s\S]*Nested/);
    expect(blocks[1].html).toBe('<ul class="contains-task-list">\n<li>Two</li>\n</ul>');
    expect(blocks[2].html).toBe('<ol start="3">\n<li>Three</li>\n</ol>');
    expect(blocks[3].html).toBe('<ol start="4">\n<li>Four</li>\n</ol>');
  });

  it("gives an empty HTML for a block that renders nothing, such as a link definition", async () => {
    await addNote("ideas", ["See [docs][d].", "", "[d]: https://example.com"].join("\n"));

    expect((await getNote(owner, "ideas"))?.blocks).toEqual([
      { start: 0, end: 14, markdown: "See [docs][d].", html: '<p>See <a href="https://example.com">docs</a>.</p>' },
      { start: 16, end: 40, markdown: "[d]: https://example.com", html: "" },
    ]);
  });

  it("does not show YAML or TOML frontmatter", async () => {
    await addNote("yaml", ["---", "title: Hidden", "---", "Body"].join("\n"));
    await addNote("toml", ["+++", "title = 'Hidden'", "+++", "Body"].join("\n"));

    expect((await getNote(owner, "yaml"))?.html).toBe("<p>Body</p>");
    expect((await getNote(owner, "toml"))?.html).toBe("<p>Body</p>");
  });

  it("gives the Todo counts, and no Note date for an Undated Note", async () => {
    await addNote("ideas", ["- [ ] Open", "- [x] Done"].join("\n"));

    expect(await getNote(owner, "ideas")).toMatchObject({ date: null, openTodoCount: 1, todoCount: 2 });
  });

  it("shows a change to a Note at the next call", async () => {
    await addNote("ideas", "Before");
    const { version, blocks } = (await getNote(owner, "ideas"))!;

    await updateNote(owner, { path: "ideas", version, range: blocks[0], markdown: "After" });

    expect((await getNote(owner, "ideas"))?.html).toBe("<p>After</p>");
  });

  it.each([
    ["a missing Note", "work/2026-09-30-missing"],
    ["a folder", "work"],
    ["a folder with a .md name", "archive"],
    ["an Asset", "work/diagram.png"],
    ["the .md extension", "work/2026-09-29-standup.md"],
    ["an empty path", ""],
    ["a trailing slash", "work/2026-09-29-standup/"],
    ["a parent segment", "work/../work/2026-09-29-standup"],
    ["a current-folder segment", "./work/2026-09-29-standup"],
    ["an absolute path", "/work/2026-09-29-standup"],
    ["a case that differs", "Work/2026-09-29-standup"],
    ["a backslash", "work\\2026-09-29-standup"],
    ["a null byte", "work/2026-09-29-standup\0"],
  ])("gives not found for %s", async (_, notePath) => {
    await addNote("work/2026-09-29-standup", "# Standup");
    await addAsset("work/diagram.png");
    await addNote("archive.md/2026-09-29-old");

    expect(await getNote(owner, notePath)).toBeNull();
  });

  it("gives not found for a Note of another Owner", async () => {
    await addNote("work/2026-09-29-secret", "# Secret", otherOwner);

    expect(await getNote(owner, "work/2026-09-29-secret")).toBeNull();
  });

  it("gives the Note of the Owner when another Owner has a Note with the same Note path", async () => {
    await addNote("ideas", "# Mine");
    await addNote("ideas", "# Theirs", otherOwner);

    expect(await getNote(owner, "ideas")).toMatchObject({ title: "Mine" });
    expect(await getNote(otherOwner, "ideas")).toMatchObject({ title: "Theirs" });
  });
});

describe("links and images in a Note", () => {
  async function html(notePath: string) {
    return (await getNote(owner, notePath))?.html ?? "";
  }

  it("rewrites a relative link to a Note to its Note view URL, from the folder of the Note", async () => {
    await addNote(
      "work/2026-09-29-standup",
      ["[Retro](2026-09-26-retro.md)", "[Books](../reading/Books.md)", "[Plan](./deep/plan.md#next-week)"].join("\n\n"),
    );

    expect(await html("work/2026-09-29-standup")).toBe(
      [
        '<p><a href="/notes/work/2026-09-26-retro">Retro</a></p>',
        '<p><a href="/notes/reading/Books">Books</a></p>',
        '<p><a href="/notes/work/deep/plan#user-content-next-week">Plan</a></p>',
      ].join("\n"),
    );
  });

  it("keeps external links and anchor links unchanged", async () => {
    await addNote(
      "ideas",
      [
        "[Docs](https://example.com/guide.md)",
        "[Protocol-relative](//example.com/a.md)",
        "[Mail](mailto:someone@example.com)",
        "[Section](#todos)",
        "<https://example.com>",
      ].join("\n\n"),
    );

    expect(await html("ideas")).toBe(
      [
        '<p><a href="https://example.com/guide.md">Docs</a></p>',
        '<p><a href="//example.com/a.md">Protocol-relative</a></p>',
        '<p><a href="mailto:someone@example.com">Mail</a></p>',
        '<p><a href="#user-content-todos">Section</a></p>',
        '<p><a href="https://example.com">https://example.com</a></p>',
      ].join("\n"),
    );
  });

  it("rewrites a relative image source to the asset URL, from the folder of the Note", async () => {
    await addNote(
      "work/2026-09-29-standup",
      ["![Diagram](../images/diagram.png)", "![Photo](<my photo.jpg>)", "![Chart](chart%20v2.svg)"].join("\n\n"),
    );

    expect(await html("work/2026-09-29-standup")).toBe(
      [
        '<p><img src="/assets/images/diagram.png" alt="Diagram"></p>',
        '<p><img src="/assets/work/my%20photo.jpg" alt="Photo"></p>',
        '<p><img src="/assets/work/chart%20v2.svg" alt="Chart"></p>',
      ].join("\n"),
    );
  });

  it("decodes a percent-encoded link to a Note before it rewrites it", async () => {
    await addNote("ideas", ["[One](my%20note.md)", "[Two](<my note.md>)"].join("\n\n"));

    expect(await html("ideas")).toBe(
      ['<p><a href="/notes/my%20note">One</a></p>', '<p><a href="/notes/my%20note">Two</a></p>'].join("\n"),
    );
  });

  it("resolves a link that starts with / from the Collection root", async () => {
    await addNote("work/2026-09-29-standup", ["[Books](/reading/Books.md)", "![Logo](/images/logo.png)"].join("\n\n"));

    expect(await html("work/2026-09-29-standup")).toBe(
      ['<p><a href="/notes/reading/Books">Books</a></p>', '<p><img src="/assets/images/logo.png" alt="Logo"></p>'].join(
        "\n",
      ),
    );
  });

  it("keeps only the text of a link or image that leaves the Collection, or that uses an unsafe scheme", async () => {
    await addNote(
      "work/2026-09-29-standup",
      [
        "[Outside](../../outside.md)",
        "![Secret](../../secret.png)",
        "[Script](javascript:alert(1))",
        "[Upper](JavaScript:alert(1))",
        "[Data](data:text/html,x)",
        "[Ref][bad]",
        "",
        "[bad]: ../../x.md",
      ].join("\n\n"),
    );

    expect(await html("work/2026-09-29-standup")).toBe(
      ["<p>Outside</p>", "<p>Secret</p>", "<p>Script</p>", "<p>Upper</p>", "<p>Data</p>", "<p>Ref</p>"].join("\n"),
    );
  });

  it("rewrites a reference-style link and image", async () => {
    await addNote("work/2026-09-29-standup", ["[Retro][r] ![Chart][c]", "", "[r]: retro.md", "[c]: chart.png"].join("\n"));

    expect(await html("work/2026-09-29-standup")).toBe(
      '<p><a href="/notes/work/retro">Retro</a> <img src="/assets/work/chart.png" alt="Chart"></p>',
    );
  });

  it("gives each heading a prefixed GitHub-style id, and points anchor links to it", async () => {
    await addNote("ideas", ["## Open Todos", "", "## Open Todos", "", "[Jump](#open-todos-1)"].join("\n"));

    expect(await html("ideas")).toBe(
      [
        '<h2 id="user-content-open-todos">Open Todos</h2>',
        '<h2 id="user-content-open-todos-1">Open Todos</h2>',
        '<p><a href="#user-content-open-todos-1">Jump</a></p>',
      ].join("\n"),
    );
  });

  it("keeps other external schemes, drops a query string and keeps an empty link", async () => {
    await addNote(
      "work/2026-09-29-standup",
      ["[Vault](obsidian://open?vault=x)", "[Retro](retro.md?v=2#top)", "[Empty]()", "[Query](?a=1)"].join("\n\n"),
    );

    expect(await html("work/2026-09-29-standup")).toBe(
      [
        '<p><a href="obsidian://open?vault=x">Vault</a></p>',
        '<p><a href="/notes/work/retro#user-content-top">Retro</a></p>',
        '<p><a href="">Empty</a></p>',
        '<p><a href="?a=1">Query</a></p>',
      ].join("\n"),
    );
  });

  it("keeps only the text of a link that leaves the Collection from the root or through an encoded ..", async () => {
    await addNote("work/2026-09-29-standup", ["[Root](/../../x.md)", "[Encoded](%2E%2E/%2E%2E/x.md)"].join("\n\n"));

    expect(await html("work/2026-09-29-standup")).toBe(["<p>Root</p>", "<p>Encoded</p>"].join("\n"));
  });
});

describe("getAsset", () => {
  it("gives the content and the media type of an Asset of the Owner", async () => {
    await addAsset("work/images/diagram.png", "png bytes");
    await addAsset("photo.JPG", "jpg bytes");
    await addAsset("my chart.svg", "<svg/>");

    expect(await getAsset(owner, "work/images/diagram.png")).toEqual({
      content: Buffer.from("png bytes"),
      mediaType: "image/png",
    });
    expect(await getAsset(owner, "photo.JPG")).toMatchObject({ mediaType: "image/jpeg" });
    expect(await getAsset(owner, "my chart.svg")).toMatchObject({ mediaType: "image/svg+xml" });
  });

  it.each([
    ["a missing image", "work/missing.png"],
    ["a Note", "work/2026-09-29-standup.md"],
    ["a folder with an image name", "work/folder.png"],
    ["a parent segment", "work/../work/diagram.png"],
    ["a current-folder segment", "./work/diagram.png"],
    ["an absolute path", "/work/diagram.png"],
    ["a case that differs", "work/Diagram.png"],
    ["an empty path", ""],
    ["a null byte", "work/diagram.png\0.png"],
  ])("gives not found for %s", async (_, assetPath) => {
    await addAsset("work/diagram.png", "png bytes");
    await addNote("work/2026-09-29-standup", "# Standup");
    await addAsset("work/folder.png/inside.png");

    expect(await getAsset(owner, assetPath)).toBeNull();
  });

  it("gives not found for an Asset of another Owner", async () => {
    await addAsset("secret.png", "secret", otherOwner);

    expect(await getAsset(owner, "secret.png")).toBeNull();
  });
});

describe("importNote and importAsset", () => {
  it("keep an existing Note or Asset unchanged and give exists", async () => {
    await addNote("ideas", "Mine");
    await addAsset("logo.png", "mine");

    expect(await importNote(owner, "ideas", "New")).toBe("exists");
    expect(await importAsset(owner, "logo.png", Buffer.from("new"))).toBe("exists");
    expect(await content("ideas")).toBe("Mine");
    expect((await getAsset(owner, "logo.png"))?.content).toEqual(Buffer.from("mine"));
  });

  it.each([
    ["an empty path", ""],
    ["an empty segment", "work//ideas"],
    ["a dot-file", "work/.ideas"],
    ["a dot-folder", ".obsidian/ideas"],
    ["a parent segment", "work/../ideas"],
    ["a null byte", "ideas\0"],
  ])("reject %s", async (_, path) => {
    await expect(importNote(owner, path, "Text")).rejects.toThrow();
    await expect(importAsset(owner, `${path}.png`, Buffer.from("x"))).rejects.toThrow();
  });

  it("rejects an Asset that is not an image", async () => {
    await expect(importAsset(owner, "report.pdf", Buffer.from("x"))).rejects.toThrow();
  });
});

describe("createNote", () => {
  const date = "2026-09-29";

  it("creates the Note in the Collection root and gives its Note path", async () => {
    const result = await createNote(owner, { title: "Weekly review", body: "- [ ] Plan", date });

    expect(result).toEqual({ path: "2026-09-29-weekly-review" });
    expect(await content("2026-09-29-weekly-review")).toBe(
      "# Weekly review\n\n- [ ] Plan\n",
    );
  });

  it.each([
    ["diacritics as plain letters", "Café crème à Zürich", "cafe-creme-a-zurich"],
    ["the letters that NFKD keeps", "Straße Æble Øre Œuvre Łódź", "strasse-aeble-ore-oeuvre-lodz"],
    ["one - for each run of other characters", "Q3 -- plan: 50% & more!", "q3-plan-50-more"],
    ["no - at the start or the end", "  (Draft) ideas?  ", "draft-ideas"],
    ["the path of a parent folder", "../../etc/x", "etc-x"],
    ["a dot-file name", ".hidden", "hidden"],
    [
      "a cut at the last - before 60 characters",
      "one two three four five six seven eight nine ten eleven twelve",
      "one-two-three-four-five-six-seven-eight-nine-ten-eleven",
    ],
    ["a cut of a word longer than 60 characters", "a".repeat(70), "a".repeat(60)],
    ["60 full characters when a - follows them", `${"a".repeat(60)} b`, "a".repeat(60)],
  ])("makes a slug with %s", async (_, title, expectedSlug) => {
    const result = await createNote(owner, { title, body: "", date });

    expect(result).toEqual({ path: `2026-09-29-${expectedSlug}` });
    expect(await paths()).toEqual([`2026-09-29-${expectedSlug}`]);
  });

  it.each([
    ["an empty title", ""],
    ["a title with only whitespace", "   "],
    ["a title with only punctuation", "?!-"],
    ["a title without Latin letters or digits", "会議"],
    ["an emoji title", "🎉"],
    ["a title with a newline", "Weekly\nreview"],
    ["a title with a carriage return", "Weekly\rreview"],
  ])("gives invalid title for %s and creates no Note", async (_, title) => {
    expect(await createNote(owner, { title, body: "Body", date })).toEqual({ reason: "invalid title" });
    expect(await paths()).toEqual([]);
  });

  it("trims the whitespace around the Note title", async () => {
    await createNote(owner, { title: "  Weekly review \t", body: "", date });

    expect(await content("2026-09-29-weekly-review")).toBe("# Weekly review\n");
  });

  it("writes only the heading and a newline for an empty body", async () => {
    await createNote(owner, { title: "Weekly review", body: "", date });

    expect(await content("2026-09-29-weekly-review")).toBe("# Weekly review\n");
  });

  it("gives the body LF line endings and one final newline, without frontmatter", async () => {
    await createNote(owner, { title: "Weekly review", body: "---\r\none\r\ntwo\rthree\n\n\n", date });

    expect(await content("2026-09-29-weekly-review")).toBe(
      "# Weekly review\n\n---\none\ntwo\nthree\n",
    );
  });

  it("gives exists and keeps the existing Note unchanged", async () => {
    await addNote("2026-09-29-weekly-review", "my own text");

    expect(await createNote(owner, { title: "Weekly review!", body: "New", date })).toEqual({ reason: "exists" });
    expect(await content("2026-09-29-weekly-review")).toBe("my own text");
  });

  it("creates the Note when another Owner has a Note with the same Note path", async () => {
    await addNote("2026-09-29-weekly-review", "theirs", otherOwner);

    expect(await createNote(owner, { title: "Weekly review", body: "", date })).toEqual({
      path: "2026-09-29-weekly-review",
    });
    expect(await content("2026-09-29-weekly-review")).toBe("# Weekly review\n");
  });

  it("creates the Note in the root, also when a Note with the same title is in a subfolder", async () => {
    await addNote("work/2026-09-29-weekly-review", "work");

    expect(await createNote(owner, { title: "Weekly review", body: "", date })).toEqual({
      path: "2026-09-29-weekly-review",
    });
    expect(await paths()).toEqual(["2026-09-29-weekly-review", "work/2026-09-29-weekly-review"]);
  });

  it("shows the new Note in the Overview and in Note by path", async () => {
    await createNote(owner, { title: "Weekly review", body: "- [ ] Plan\n- [x] Look back", date });

    expect(await getOverview(owner)).toEqual([
      {
        date: "2026-09-29",
        notes: [
          {
            path: "2026-09-29-weekly-review",
            filename: "2026-09-29-weekly-review.md",
            title: "Weekly review",
            todoCount: 2,
            openTodoCount: 1,
          },
        ],
      },
    ]);
    expect(await getNote(owner, "2026-09-29-weekly-review")).toMatchObject({
      title: "Weekly review",
      date: "2026-09-29",
    });
  });
});

describe("updateNote", () => {
  const path = "work/ideas";
  const file = () => content(path);

  async function note() {
    const loaded = await getNote(owner, path);
    if (!loaded) throw new Error("The fixture Note is missing");
    return loaded;
  }

  async function update(range: { start: number; end: number }, markdown: string, version?: string) {
    return updateNote(owner, { path, version: version ?? (await note()).version, range, markdown });
  }

  async function updateBlock(index: number, markdown: string) {
    const { blocks } = await note();
    return update(blocks[index], markdown);
  }

  it("replaces only the characters of the block, and keeps the frontmatter and all other bytes", async () => {
    const before = ["---", "title: Keep  me", "---", "# Ideas", "", "Old  *text*", "", "* list   item", ""].join("\n");
    await addNote("work/ideas", before);

    const result = await updateBlock(1, "New text");

    const after = await file();
    expect(after).toBe(before.replace("Old  *text*", "New text"));
    expect(result).toEqual({
      version: createHash("sha256").update(after!).digest("hex"),
      range: { start: 33, end: 41 },
    });
    expect((await note()).version).toBe(createHash("sha256").update(after!).digest("hex"));
  });

  it("gives the Overview the new Note title and Todo counts", async () => {
    await addNote("work/2026-09-29-ideas", "# Old\n\n- [ ] One\n");
    const { version, blocks } = (await getNote(owner, "work/2026-09-29-ideas"))!;

    await updateNote(owner, { path: "work/2026-09-29-ideas", version, range: blocks[0], markdown: "# New" });
    const { blocks: newBlocks, version: newVersion } = (await getNote(owner, "work/2026-09-29-ideas"))!;
    await updateNote(owner, {
      path: "work/2026-09-29-ideas",
      version: newVersion,
      range: newBlocks[1],
      markdown: "- [x] One\n- [ ] Two\n- [ ] Three",
    });

    expect(await onlyNote()).toMatchObject({ title: "New", openTodoCount: 2, todoCount: 3 });
  });

  it("gives changed on disk for an old version, and keeps the Note unchanged", async () => {
    await addNote("work/ideas", "Old");
    const { version, blocks } = await note();
    await update(blocks[0], "Changed in another tab");

    expect(await update(blocks[0], "New", version)).toEqual({ reason: "changed on disk" });
    expect(await file()).toBe("Changed in another tab");
  });

  it("gives changed on disk for a write that lands between the version check and the save", async () => {
    await addNote("work/ideas", "Old");
    const { version, blocks } = await note();
    const other = postgres(process.env.DATABASE_URL!, { max: 1 });
    let save!: ReturnType<typeof update>;
    try {
      await other.begin(async (transaction) => {
        await transaction`UPDATE notes SET markdown = 'Other', version = 'other' WHERE path = ${path}`;
        save = update(blocks[0], "Mine", version);
        // The save reads the old version, and its UPDATE then waits for the lock of this transaction.
        while ((await transaction`SELECT 1 FROM pg_locks WHERE NOT granted`).length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      });
    } finally {
      await other.end();
    }

    expect(await save).toEqual({ reason: "changed on disk" });
    expect(await file()).toBe("Other");
  });

  it("gives not found for a Note that was deleted", async () => {
    await addNote("work/ideas", "Old");
    const { version, blocks } = await note();
    await db().delete(notes).where(eq(notes.path, path));

    expect(await update(blocks[0], "New", version)).toEqual({ reason: "not found" });
    expect(await paths()).toEqual([]);
  });

  it.each([
    ["a missing Note", "work/missing"],
    ["the .md extension", "work/ideas.md"],
    ["a parent segment", "work/../work/ideas"],
    ["an absolute path", "/work/ideas"],
  ])("gives not found for %s, and writes nothing", async (_, notePath) => {
    await addNote("work/ideas", "Inside");
    const version = createHash("sha256").update("Inside").digest("hex");

    expect(await updateNote(owner, { path: notePath, version, range: { start: 0, end: 6 }, markdown: "X" })).toEqual({
      reason: "not found",
    });
    expect(await file()).toBe("Inside");
  });

  it("gives not found for a Note of another Owner, and keeps it unchanged", async () => {
    await addNote("work/ideas", "Theirs", otherOwner);
    const version = createHash("sha256").update("Theirs").digest("hex");

    expect(await update({ start: 0, end: 6 }, "Mine", version)).toEqual({ reason: "not found" });
    expect((await exportNotes(otherOwner))[0].markdown).toBe("Theirs");
  });

  it("ticks and unticks a nested Todo in a list item block", async () => {
    await addNote("work/ideas", ["- [ ] Plan", "  - [x] Book a room", "- [ ] Later", ""].join("\n"));
    const [block] = (await note()).blocks;

    await update(block, block.markdown.replace("[ ] Plan", "[x] Plan").replace("[x] Book", "[ ] Book"));

    expect(await file()).toBe(["- [x] Plan", "  - [ ] Book a room", "- [ ] Later", ""].join("\n"));
    expect(await note()).toMatchObject({ openTodoCount: 2, todoCount: 3 });
  });

  it("splits a block at an empty line, so the parts become separate blocks", async () => {
    await addNote("work/ideas", "# Ideas\n\nOne\n");

    const result = await updateBlock(1, "One\n\nTwo");

    expect(result).toMatchObject({ range: { start: 9, end: 17 } });
    expect((await note()).blocks.map(({ markdown }) => markdown)).toEqual(["# Ideas", "One", "Two"]);
  });

  it("drops the blank lines and whitespace at the start and the end of the new Markdown", async () => {
    await addNote("work/ideas", "One\n\nTwo\n");

    await updateBlock(0, "\n  \nNew  \n\n");

    expect(await file()).toBe("New\n\nTwo\n");
  });

  it("keeps the CRLF line endings of a file", async () => {
    await addNote("work/ideas", "One\r\n\r\nTwo\r\n");

    await updateBlock(0, "New\nlines");

    expect(await file()).toBe("New\r\nlines\r\n\r\nTwo\r\n");
  });

  it.each([
    ["a paragraph between two blocks", "One\n\nTwo\n\nThree\n", 1, "One\n\nThree\n"],
    ["a list item in a tight list", "- a\n- b\n- c\n", 1, "- a\n- c\n"],
    ["the last block", "---\nx: 1\n---\n\nOne\n\nTwo\n", 1, "---\nx: 1\n---\n\nOne\n"],
    ["the only block after the frontmatter", "---\nx: 1\n---\n\nOne\n", 0, "---\nx: 1\n---\n"],
    ["the only block", "One\n", 0, ""],
  ])("removes %s with no text, and its blank lines", async (_, before, index, after) => {
    await addNote("work/ideas", before);

    const result = await updateBlock(index, " \n ");

    expect(await file()).toBe(after);
    expect(result).toMatchObject({ range: { start: expect.any(Number) } });
  });

  it.each([
    ["after a paragraph", "One\n", "Two", "One\n\nTwo\n", 5],
    ["after a file without a final newline", "One", "Two", "One\n\nTwo\n", 5],
    ["to a list, as an item of the same list", "- [ ] a\n\n\n", "- [ ] b", "- [ ] a\n- [ ] b\n", 8],
    ["after a list, as a paragraph", "- a\n", "Two", "- a\n\nTwo\n", 5],
    ["after the frontmatter", "---\nx: 1\n---\n", "One", "---\nx: 1\n---\n\nOne\n", 14],
    ["to an empty Note", "", "One", "One\n", 0],
  ])("adds a block at the end %s", async (_, before, markdown, after, start) => {
    await addNote("work/ideas", before);
    const { length } = await note();

    const result = await update({ start: length, end: length }, markdown);

    expect(await file()).toBe(after);
    expect(result).toMatchObject({ range: { start, end: start + markdown.length } });
  });

  it.each([
    ["inside the frontmatter", { start: 4, end: 8 }],
    ["that overlaps the frontmatter", { start: 10, end: 16 }],
    ["that starts at the line break after the frontmatter", { start: 12, end: 17 }],
    ["that ends after the file", { start: 15, end: 99 }],
    ["that ends before it starts", { start: 17, end: 16 }],
    ["that is empty before the end of the file", { start: 15, end: 15 }],
    ["with a fraction", { start: 15.5, end: 18 }],
  ])("throws for a range %s, and keeps the file unchanged", async (_, range) => {
    await addNote("work/ideas", "---\nx: 1\n---\n\nOne\n");

    await expect(update(range, "New")).rejects.toThrow();
    expect(await file()).toBe("---\nx: 1\n---\n\nOne\n");
  });
});
