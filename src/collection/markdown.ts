import type { Root } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ["yaml", "toml"]);

export function parseNote(markdown: string): Root {
  return parser.parse(markdown);
}

export type TodoCounts = { openTodoCount: number; todoCount: number };

export function headingTitle(tree: Root): string | null {
  for (const node of tree.children) {
    if (node.type !== "heading" || node.depth !== 1) continue;
    const text = toString(node, { includeHtml: false, includeImageAlt: false }).replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return null;
}

export function countTodos(tree: Root): TodoCounts {
  let openTodoCount = 0;
  let todoCount = 0;
  visit(tree, "listItem", (item) => {
    if (typeof item.checked !== "boolean") return;
    todoCount++;
    if (!item.checked) openTodoCount++;
  });
  return { openTodoCount, todoCount };
}

const renderer = unified().use(remarkRehype).use(rehypeStringify);

export function renderNote(tree: Root): string {
  return renderer.stringify(renderer.runSync(tree));
}
