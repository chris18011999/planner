import { posix } from "node:path";

// GitHub prefixes the ids in rendered Markdown. A heading id such as "__next_f" can otherwise replace a global of the page.
export const ID_PREFIX = "user-content-";

const UNSAFE_SCHEMES = ["javascript:", "vbscript:", "data:"];

export function noteHref(notePath: string): string {
  return `/notes/${encodePath(notePath)}`;
}

export function assetHref(assetPath: string): string {
  return `/assets/${encodePath(assetPath)}`;
}

// Next.js passes catch-all segments still percent-encoded.
export function decodeUrlSegments(segments: string[]): string | null {
  const decoded = segments.map(decodeOrNull);
  return decoded.every((segment) => segment !== null) ? decoded.join("/") : null;
}

// Gives null for a URL that the Note view must not link to.
export function rewriteUrl(url: string, noteFolders: string[], kind: "link" | "image"): string | null {
  const scheme = /^([a-z][a-z\d+.-]*:)/i.exec(url)?.[1];
  if (scheme) return UNSAFE_SCHEMES.includes(scheme.toLowerCase()) ? null : url;
  if (url.startsWith("//")) return url;
  const [, target, fragment = ""] = /^([^?#]*)(?:\?[^#]*)?(#.*)?$/.exec(url) ?? [];
  if (!target) return url.startsWith("#") ? prefixFragment(fragment) : url;
  const decoded = decodeOrNull(target) ?? target;
  const base = decoded.startsWith("/") ? [] : noteFolders;
  const path = posix.join(".", ...base, decoded);
  if (path === "." || path === ".." || path.startsWith("../")) return null;
  if (kind === "link" && path.endsWith(".md")) return noteHref(path.replace(/\.md$/, "")) + prefixFragment(fragment);
  return assetHref(path);
}

function prefixFragment(fragment: string) {
  if (fragment.length <= 1 || fragment.startsWith(`#${ID_PREFIX}`)) return fragment;
  return `#${ID_PREFIX}${fragment.slice(1)}`;
}

function decodeOrNull(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}
