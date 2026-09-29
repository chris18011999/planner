import type { ElementContent, Root as HastRoot } from "hast";
import type { Root } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { ID_PREFIX, rewriteUrl } from "./urls";

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

const renderer = unified().use(remarkRehype).use(rehypeSlug, { prefix: ID_PREFIX }).use(rehypeStringify);

const URL_ATTRIBUTES = {
  a: { attribute: "href", kind: "link" },
  img: { attribute: "src", kind: "image" },
} as const;

export function renderNote(tree: Root, noteFolders: string[]): string {
  const html = renderer.runSync(tree);
  rewriteUrls(html, noteFolders);
  return renderer.stringify(html);
}

// The HTML tree is the first place where a reference-style link and its definition meet.
function rewriteUrls(html: HastRoot, noteFolders: string[]) {
  visit(html, "element", (element, index, parent) => {
    if (!Object.hasOwn(URL_ATTRIBUTES, element.tagName) || !parent || index === undefined) return;
    const { attribute, kind } = URL_ATTRIBUTES[element.tagName as keyof typeof URL_ATTRIBUTES];
    const url = element.properties[attribute];
    if (typeof url !== "string") return;
    const rewritten = rewriteUrl(url, noteFolders, kind);
    if (rewritten !== null) {
      element.properties[attribute] = rewritten;
      return;
    }
    const alt = element.properties.alt;
    const replacement: ElementContent[] =
      kind === "link" ? element.children : typeof alt === "string" && alt ? [{ type: "text", value: alt }] : [];
    parent.children.splice(index, 1, ...replacement);
    return index;
  });
}
