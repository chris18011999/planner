# 05 — Links and images inside a Note

**What to build:** In a Note view, a relative link to another Note opens that Note's Note view. Images that the Note references from the Collection show in the page. External links and anchor links work as usual. The app never serves a file from outside the Collection.

**Blocked by:** 04 — Note view with rendered Markdown.

**Status:** ready-for-agent

- [ ] A relative link to a `.md` file resolves against the folder of the current Note and becomes that Note's Note view URL.
- [ ] External links and anchor links stay unchanged.
- [ ] A relative image source becomes an asset URL.
- [ ] The Collection module exposes Asset by path. It returns the file content and its media type.
- [ ] Asset by path gives "not found" for a path outside the Collection.
- [ ] Tests call Note by path to check the rewritten links and image sources.
- [ ] Tests call Asset by path, including path-escape attempts such as `../`.
