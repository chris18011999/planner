import { mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CollectionPathError, getAsset, getNote, getOverview } from "./collection";

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
      html: "<h1 id=\"user-content-standup\">Standup</h1>\n<p>Some <em>text</em>.</p>",
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

describe("links and images in a Note", () => {
  async function html(notePath: string) {
    return (await getNote(collection, notePath))?.html ?? "";
  }

  it("rewrites a relative link to a Note to its Note view URL, from the folder of the Note", async () => {
    await addFile(
      "work/2026-09-29-standup.md",
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
    await addFile(
      "ideas.md",
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
    await addFile(
      "work/2026-09-29-standup.md",
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
    await addFile("ideas.md", ["[One](my%20note.md)", "[Two](<my note.md>)"].join("\n\n"));

    expect(await html("ideas")).toBe(
      ['<p><a href="/notes/my%20note">One</a></p>', '<p><a href="/notes/my%20note">Two</a></p>'].join("\n"),
    );
  });

  it("resolves a link that starts with / from the Collection root", async () => {
    await addFile("work/2026-09-29-standup.md", ["[Books](/reading/Books.md)", "![Logo](/images/logo.png)"].join("\n\n"));

    expect(await html("work/2026-09-29-standup")).toBe(
      ['<p><a href="/notes/reading/Books">Books</a></p>', '<p><img src="/assets/images/logo.png" alt="Logo"></p>'].join(
        "\n",
      ),
    );
  });

  it("keeps only the text of a link or image that leaves the Collection, or that uses an unsafe scheme", async () => {
    await addFile(
      "work/2026-09-29-standup.md",
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
    await addFile("work/2026-09-29-standup.md", ["[Retro][r] ![Chart][c]", "", "[r]: retro.md", "[c]: chart.png"].join("\n"));

    expect(await html("work/2026-09-29-standup")).toBe(
      '<p><a href="/notes/work/retro">Retro</a> <img src="/assets/work/chart.png" alt="Chart"></p>',
    );
  });

  it("gives each heading a prefixed GitHub-style id, and points anchor links to it", async () => {
    await addFile("ideas.md", ["## Open Todos", "", "## Open Todos", "", "[Jump](#open-todos-1)"].join("\n"));

    expect(await html("ideas")).toBe(
      [
        '<h2 id="user-content-open-todos">Open Todos</h2>',
        '<h2 id="user-content-open-todos-1">Open Todos</h2>',
        '<p><a href="#user-content-open-todos-1">Jump</a></p>',
      ].join("\n"),
    );
  });

  it("keeps other external schemes, drops a query string and keeps an empty link", async () => {
    await addFile(
      "work/2026-09-29-standup.md",
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
    await addFile("work/2026-09-29-standup.md", ["[Root](/../../x.md)", "[Encoded](%2E%2E/%2E%2E/x.md)"].join("\n\n"));

    expect(await html("work/2026-09-29-standup")).toBe(["<p>Root</p>", "<p>Encoded</p>"].join("\n"));
  });
});

describe("getAsset", () => {
  it("gives the content and the media type of an image in the Collection", async () => {
    await addFile("work/images/diagram.png", "png bytes");
    await addFile("photo.JPG", "jpg bytes");
    await addFile("my chart.svg", "<svg/>");

    expect(await getAsset(collection, "work/images/diagram.png")).toEqual({
      content: Buffer.from("png bytes"),
      mediaType: "image/png",
    });
    expect(await getAsset(collection, "photo.JPG")).toMatchObject({ mediaType: "image/jpeg" });
    expect(await getAsset(collection, "my chart.svg")).toMatchObject({ mediaType: "image/svg+xml" });
  });

  it.each([
    ["a missing image", "work/missing.png"],
    ["a Note", "work/2026-09-29-standup.md"],
    ["a file that is not an image", "work/report.pdf"],
    ["a folder with an image name", "work/folder.png"],
    ["an image in a dot-folder", ".obsidian/icon.png"],
    ["a parent segment that leaves the Collection", "../outside.png"],
    ["a parent segment inside the path", "work/../../outside.png"],
    ["a current-folder segment", "./work/diagram.png"],
    ["an absolute path", "/etc/diagram.png"],
    ["an empty path", ""],
    ["a null byte", "work/diagram.png\0.png"],
  ])("gives not found for %s", async (_, assetPath) => {
    await addFile("notes/work/diagram.png", "png bytes");
    await addFile("notes/work/2026-09-29-standup.md", "# Standup");
    await addFile("notes/work/report.pdf");
    await addFile("notes/work/folder.png/inside.png");
    await addFile("notes/.obsidian/icon.png");
    await addFile("outside.png", "secret");

    expect(await getAsset(join(collection, "notes"), assetPath)).toBeNull();
  });

  it("gives not found for a symbolic link that leaves the Collection", async () => {
    const outside = await mkdtemp(join(tmpdir(), "planner-outside-"));
    try {
      await writeFile(join(outside, "secret.png"), "secret");
      await symlink(join(outside, "secret.png"), join(collection, "secret.png"));
      await symlink(outside, join(collection, "linked"));

      expect(await getAsset(collection, "secret.png")).toBeNull();
      expect(await getAsset(collection, "linked/secret.png")).toBeNull();
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

