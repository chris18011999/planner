export type TextEdit = { start: number; end: number; insert: string };

const LIST_MARKER = /^([ \t]*)(?:([*+-])|(\d{1,9})([.)]))([ \t]+)(\[[ xX]\](?:[ \t]+|$))?/;

// Enter at the end of a list item line continues the list. Enter on an item with only its marker ends the list.
export function listEnter(value: string, selectionStart: number, selectionEnd: number): TextEdit | null {
  if (selectionStart !== selectionEnd) return null;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const newline = value.indexOf("\n", selectionStart);
  const lineEnd = newline === -1 ? value.length : newline;
  if (selectionStart !== lineEnd) return null;
  const line = value.slice(lineStart, lineEnd);
  const match = LIST_MARKER.exec(line);
  if (!match) return null;
  if (match[0].length === line.length) return { start: lineStart, end: lineEnd, insert: "" };
  const [, indent, bullet, number, delimiter, spacing, todo] = match;
  const marker = bullet ?? `${Number(number) + 1}${delimiter}`;
  return { start: lineEnd, end: lineEnd, insert: `\n${indent}${marker}${spacing}${todo ? "[ ] " : ""}` };
}

export function toggleTodo(markdown: string, offset: number): string {
  const mark = markdown[offset] === " " ? "x" : " ";
  return markdown.slice(0, offset) + mark + markdown.slice(offset + 1);
}
