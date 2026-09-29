import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTestDatabase } from "../db/test-database";
import { ensureUser } from "../db/users";
import { exportAssets, exportNotes, getAsset, getNote, importNote } from "./collection";
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
  it("creates a Note for each .md file and an Asset for each image, in all subfolders", async () => {
    await addFile("2026-09-29-standup.md", "# Standup\n\n- [ ] Plan\n");
    await addFile("work/deep/ideas.md", "Ideas");
    await addFile("work/images/diagram.PNG", "png bytes");

    const result = await importFolder(owner, folder);

    expect(result).toEqual({
      created: ["2026-09-29-standup.md", "work/deep/ideas.md", "work/images/diagram.PNG"],
      existing: [],
    });
    expect(await getNote(owner, "2026-09-29-standup")).toMatchObject({
      title: "Standup",
      date: "2026-09-29",
      openTodoCount: 1,
    });
    expect(await getNote(owner, "work/deep/ideas")).toMatchObject({ title: "ideas" });
    expect(await getAsset(owner, "work/images/diagram.PNG")).toEqual({
      content: Buffer.from("png bytes"),
      mediaType: "image/png",
    });
  });

  it("skips dot-files, dot-folders, symbolic links and files that are neither .md nor an image", async () => {
    await addFile("2026-09-29-standup.md");
    await addFile(".2026-09-29-hidden.md");
    await addFile(".obsidian/2026-09-29-workspace.md");
    await addFile("work/.git/2026-09-29-head.md");
    await addFile("work/.icon.png");
    await addFile("2026-09-29-draft.markdown");
    await addFile("report.pdf");
    await writeFile(join(outside, "secret.md"), "# Secret");
    await writeFile(join(outside, "secret.png"), "secret");
    await symlink(join(outside, "secret.md"), join(folder, "secret.md"));
    await symlink(join(outside, "secret.png"), join(folder, "secret.png"));
    await symlink(outside, join(folder, "linked"));

    expect(await importFolder(owner, folder)).toEqual({ created: ["2026-09-29-standup.md"], existing: [] });
    expect(await exportAssets(owner)).toEqual([]);
  });

  it("keeps an existing Note or Asset unchanged, and lists it", async () => {
    await importNote(owner, "ideas", "Mine");
    await addFile("ideas.md", "From the folder");
    await addFile("logo.png", "first");
    await importFolder(owner, folder);
    await addFile("logo.png", "second");
    await addFile("new.md", "New");

    expect(await importFolder(owner, folder)).toEqual({ created: ["new.md"], existing: ["ideas.md", "logo.png"] });
    expect(await exportNotes(owner)).toContainEqual({ path: "ideas", markdown: "Mine" });
    expect((await getAsset(owner, "logo.png"))?.content).toEqual(Buffer.from("first"));
  });

  it("lists what it would create with dryRun, and creates nothing", async () => {
    await importNote(owner, "ideas", "Mine");
    await addFile("ideas.md", "From the folder");
    await addFile("new.md", "New");
    await addFile("logo.png", "png");

    expect(await importFolder(owner, folder, { dryRun: true })).toEqual({
      created: ["logo.png", "new.md"],
      existing: ["ideas.md"],
    });
    expect(await notePaths()).toEqual(["ideas"]);
    expect(await exportAssets(owner)).toEqual([]);
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
  it("writes each Note and each Asset of the Owner to its path in the folder", async () => {
    const other = await ensureUser("other@example.com");
    await importNote(owner, "work/2026-09-29-standup", "# Standup\n");
    await importNote(other, "secret", "# Secret\n");
    await addFile("images/logo.png", "png");
    await importFolder(owner, folder);
    const target = join(outside, "export");

    await exportFolder(owner, target);

    expect(await files(target)).toEqual({
      "images/logo.png": Buffer.from("png").toString("base64"),
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
    await addFile("work/images/photo.jpg", Buffer.from([0, 255, 1, 254]));
    await addFile("my chart.svg", "<svg/>");
    const target = join(outside, "export");

    await importFolder(owner, folder);
    await exportFolder(owner, target);

    expect(await files(target)).toEqual(await files(folder));
  });
});
