# 05 — Links and images inside a Note

**What to build:** In a Note view, a relative link to another Note opens that Note's Note view. Images that the Note references from the Collection show in the page. External links and anchor links work as usual. The app never serves a file from outside the Collection.

**Blocked by:** 04 — Note view with rendered Markdown.

**Status:** done

- [x] A relative link to a `.md` file resolves against the folder of the current Note and becomes that Note's Note view URL.
- [x] External links and anchor links stay unchanged.
- [x] A relative image source becomes an asset URL.
- [x] The Collection module exposes Asset by path. It returns the file content and its media type.
- [x] Asset by path gives "not found" for a path outside the Collection.
- [x] Tests call Note by path to check the rewritten links and image sources.
- [x] Tests call Asset by path, including path-escape attempts such as `../`.

## Comments

**Implementation decisions:**

- The asset URL is `/assets/<path>`. A relative link to a file that is not `.md` also becomes an asset URL.
- A link that starts with `/` resolves from the Collection root.
- A link or image that resolves outside the Collection keeps only its text. An image keeps its alt text.
- A `javascript:`, `vbscript:` or `data:` link keeps only its text. Other schemes, for example `obsidian://`, stay unchanged.
- The rewrite runs on the HTML tree. This is the first place where a reference-style link and its definition meet.
- Headings get GitHub-style ids with the prefix `user-content-`. Anchor links get the same prefix. The prefix stops a heading id from replacing a global of the page.
- Asset by path serves only images: `.avif`, `.gif`, `.jpeg`, `.jpg`, `.png`, `.svg` and `.webp`, in any case.
- The asset response has a Content Security Policy with `sandbox`, so scripts in an SVG do not run.

