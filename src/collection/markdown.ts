import type { Element, ElementContent, Root as HastRoot } from "hast";
import type { Root, RootContent } from "mdast";
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

export type BlockRange = { start: number; end: number };

export type NoteBlock = BlockRange & {
  markdown: string;
  html: string;
};

export type RenderedNote = {
  html: string;
  blocks: NoteBlock[];
};

// The whole Note renders as one tree, so heading ids stay unique and reference-style links find their definitions.
export function renderNote(tree: Root, noteFolders: string[], markdown: string): RenderedNote {
  const html = renderer.runSync(tree);
  rewriteUrls(html, noteFolders);
  markTodos(html, markdown);
  const elements = blockElements(html);
  const blocks = blockNodes(tree).map(({ position }) => {
    const start = position!.start.offset!;
    const end = position!.end.offset!;
    const element = elements.get(start);
    return {
      start,
      end,
      markdown: markdown.slice(start, end),
      html: element ? renderer.stringify({ type: "root", children: [element] }) : "",
    };
  });
  return { html: renderer.stringify(html), blocks };
}

export function blockNodes(tree: Root): RootContent[] {
  return tree.children.flatMap((node) => {
    if (isFrontmatter(node)) return [];
    return node.type === "list" ? node.children : [node];
  });
}

// The body starts after the line break that ends the frontmatter.
export function bodyStart(tree: Root): number {
  const [first] = tree.children;
  return first && isFrontmatter(first) ? first.position!.end.offset! + 1 : 0;
}

// The mdast types declare only YAML frontmatter, but remark-frontmatter also gives "toml" nodes.
function isFrontmatter(node: RootContent) {
  return node.type === "yaml" || (node.type as string) === "toml";
}

// A block of one list item keeps its list around it, with the number of that item for an ordered list.
function blockElements(html: HastRoot): Map<number, Element> {
  const elements = new Map<number, Element>();
  for (const child of html.children) {
    if (child.type !== "element") continue;
    if (child.tagName !== "ul" && child.tagName !== "ol") {
      if (child.position?.start.offset !== undefined) elements.set(child.position.start.offset, child);
      continue;
    }
    const firstNumber = typeof child.properties.start === "number" ? child.properties.start : 1;
    const items = child.children.filter((item) => item.type === "element");
    items.forEach((item, index) => {
      if (item.position?.start.offset === undefined) return;
      const number = firstNumber + index;
      const properties = child.tagName === "ol" && number !== 1 ? { ...child.properties, start: number } : child.properties;
      const text = { type: "text" as const, value: "\n" };
      elements.set(item.position.start.offset, { ...child, properties, children: [text, item, text] });
    });
  }
  return elements;
}

const TODO_MARK = /^(?:[*+-]|\d{1,9}[.)])[ \t]+\[/;

// The data-offset attribute gives the offset of the character between the brackets of the Todo in the file.
function markTodos(html: HastRoot, markdown: string) {
  visit(html, "element", (item) => {
    const start = item.position?.start.offset;
    const mark = start === undefined ? null : TODO_MARK.exec(markdown.slice(start));
    const input = item.tagName === "li" ? todoCheckbox(item) : undefined;
    if (!mark || !input) return;
    delete input.properties.disabled;
    input.properties.dataOffset = start! + mark[0].length;
  });
}

// The checkbox is the first child of a tight list item, or the first child of its paragraph in a loose list.
function todoCheckbox(item: Element): Element | undefined {
  const first = item.children.find((child) => child.type === "element");
  const candidate = first?.tagName === "p" ? first.children.find((child) => child.type === "element") : first;
  return candidate?.tagName === "input" && candidate.properties.type === "checkbox" ? candidate : undefined;
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
