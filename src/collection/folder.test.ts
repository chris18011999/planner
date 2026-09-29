import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTestDatabase } from "../db/test-database";
import { ensureUser } from "../db/users";
import { exportNotes, getNote, importNote } from "./collection";
import { exportFolder, importFolder } from "./folder";

setupTestDatabase();

let owner: string;
let folder: string;
let outside: string;

beforeEach(async () => {
  owner = await ensureUser("me@example.com");
  folder = await mkdtemp(join(tmpdir(), "planner-import-"));
  outside = await mkdtemp(join(tmpdir(), "planner-outside-"));
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

async function addFile(path: string, content: string | Buffer = "") {
  const file = join(folder, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function files(root: string): Promise<Record<string, string>> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const result: Record<string, string> = {};
  for (const entry of entries.filter((entry) => entry.isFile())) {
    const file = join(entry.parentPath, entry.name);
    result[file.slice(root.length + 1)] = (await readFile(file)).toString("base64");
  }
  return result;
}

async function notePaths() {
  return (await exportNotes(owner)).map(({ path }) => path).sort();
}

describe("importFolder", () => {
  it("creates a Note for each .md file, in all subfolders", async () => {
    await addFile("2026-09-29-standup.md", "# Standup\n\n- [ ] Plan\n");
    await addFile("work/deep/ideas.md", "Ideas");

    const result = await importFolder(owner, folder);

    expect(result).toEqual({ created: ["2026-09-29-standup.md", "work/deep/ideas.md"], existing: [] });
    expect(await getNote(owner, "2026-09-29-standup")).toMatchObject({
      title: "Standup",
      date: "2026-09-29",
      openTodoCount: 1,
    });
    expect(await getNote(owner, "work/deep/ideas")).toMatchObject({ title: "ideas" });
  });

  it("skips dot-files, dot-folders, symbolic links, images and other files that are not .md", async () => {
    await addFile("2026-09-29-standup.md");
    await addFile(".2026-09-29-hidden.md");
    await addFile(".obsidian/2026-09-29-workspace.md");
    await addFile("work/.git/2026-09-29-head.md");
    await addFile("work/images/diagram.png");
    await addFile("2026-09-29-draft.markdown");
    await addFile("report.pdf");
    await writeFile(join(outside, "secret.md"), "# Secret");
    await symlink(join(outside, "secret.md"), join(folder, "secret.md"));
    await symlink(outside, join(folder, "linked"));

    expect(await importFolder(owner, folder)).toEqual({ created: ["2026-09-29-standup.md"], existing: [] });
    expect(await notePaths()).toEqual(["2026-09-29-standup"]);
  });

  it("keeps an existing Note unchanged, and lists it", async () => {
    await importNote(owner, "ideas", "Mine");
    await addFile("ideas.md", "From the folder");
    await addFile("new.md", "New");

    expect(await importFolder(owner, folder)).toEqual({ created: ["new.md"], existing: ["ideas.md"] });
    expect(await exportNotes(owner)).toContainEqual({ path: "ideas", markdown: "Mine" });
  });

  it("lists what it would create with dryRun, and creates nothing", async () => {
    await importNote(owner, "ideas", "Mine");
    await addFile("ideas.md", "From the folder");
    await addFile("new.md", "New");

    expect(await importFolder(owner, folder, { dryRun: true })).toEqual({ created: ["new.md"], existing: ["ideas.md"] });
    expect(await notePaths()).toEqual(["ideas"]);
  });

  it("throws for a .md file that is not valid UTF-8", async () => {
    await addFile("broken.md", Buffer.from([0x23, 0x20, 0xff]));

    await expect(importFolder(owner, folder)).rejects.toThrow();
  });

  it("throws for a folder that does not exist", async () => {
    await expect(importFolder(owner, join(folder, "missing"))).rejects.toThrow();
  });
});

describe("exportFolder", () => {
  it("writes each Note of the Owner to its path in the folder", async () => {
    const other = await ensureUser("other@example.com");
    await importNote(owner, "work/2026-09-29-standup", "# Standup\n");
    await importNote(other, "secret", "# Secret\n");
    const target = join(outside, "export");

    await exportFolder(owner, target);

    expect(await files(target)).toEqual({
      "work/2026-09-29-standup.md": Buffer.from("# Standup\n").toString("base64"),
    });
  });

  it("writes into an empty folder that exists", async () => {
    await importNote(owner, "ideas", "Ideas");

    await exportFolder(owner, outside);

    expect(await readFile(join(outside, "ideas.md"), "utf8")).toBe("Ideas");
  });

  it("refuses a folder that is not empty, and writes nothing", async () => {
    await importNote(owner, "ideas", "Ideas");
    await writeFile(join(outside, ".keep"), "");

    await expect(exportFolder(owner, outside)).rejects.toThrow(/not empty/);
    expect(await readdir(outside)).toEqual([".keep"]);
  });

  it("gives back the same files after an import and an export", async () => {
    await addFile("2026-09-29-standup.md", "---\ntitle: x\n---\r\n# Standup\r\n\r\n- [ ] Café\r\n");
    await addFile("work/deep/Books.md", "");
    await addFile("my notes/ideas.md", "\uFEFF# Ideas with a BOM\n");
    const target = join(outside, "export");

    await importFolder(owner, folder);
    await exportFolder(owner, target);

    expect(await files(target)).toEqual(await files(folder));
  });
});
