import { describe, expect, it } from "vitest";
import { listEnter, toggleTodo } from "./block-editing";

function enter(value: string, caret = value.length) {
  return listEnter(value, caret, caret);
}

describe("listEnter", () => {
  it.each([
    ["a bullet", "- one", "\n- "],
    ["a Todo", "- [x] one", "\n- [ ] "],
    ["a numbered item", "  9. one", "\n  10. "],
    ["a numbered item with a )", "1) one", "\n2) "],
    ["a * bullet with more spaces", "*   one", "\n*   "],
  ])("starts a new item with the same marker at the end of %s", (_, line, insert) => {
    expect(enter(`Intro\n${line}`)).toEqual({ start: 6 + line.length, end: 6 + line.length, insert });
  });

  it("starts a new item at the end of a line in the middle of the text", () => {
    expect(enter("- one\n- two", 5)).toEqual({ start: 5, end: 5, insert: "\n- " });
  });

  it.each([
    ["an empty bullet", "- a\n- "],
    ["an empty Todo", "- a\n- [ ] "],
    ["an empty Todo without a space after it", "- a\n- [ ]"],
  ])("removes the marker of %s", (_, value) => {
    expect(enter(value)).toEqual({ start: 4, end: value.length, insert: "" });
  });

  it.each([
    ["a line that is not a list item", "Some text"],
    ["a - without a space", "-one"],
    ["a caret in the middle of the line", "- one", 3],
    ["a selection", "- one", undefined, true],
  ])("gives null for %s", (_, value, caret = value.length, selection = false) => {
    expect(listEnter(value, selection ? 0 : caret, caret)).toBeNull();
  });
});

describe("toggleTodo", () => {
  it("ticks an Open Todo and unticks a checked Todo at the offset", () => {
    expect(toggleTodo("- [ ] a\n  - [X] b", 3)).toBe("- [x] a\n  - [X] b");
    expect(toggleTodo("- [ ] a\n  - [X] b", 13)).toBe("- [ ] a\n  - [ ] b");
  });
});
