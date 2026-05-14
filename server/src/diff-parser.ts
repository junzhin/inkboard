import { createPatch, parsePatch } from "diff";
import { readFileSync, existsSync } from "node:fs";
import type { Hunk } from "./types.js";

export function editToHunks(
  filePath: string,
  oldString: string,
  newString: string
): Hunk[] {
  const currentContent = existsSync(filePath)
    ? readFileSync(filePath, "utf-8")
    : "";

  const newContent = currentContent.replace(oldString, newString);
  if (newContent === currentContent) {
    return [];
  }

  return computeHunks(filePath, currentContent, newContent);
}

export function writeToHunks(filePath: string, content: string): Hunk[] {
  const currentContent = existsSync(filePath)
    ? readFileSync(filePath, "utf-8")
    : "";

  if (currentContent === content) {
    return [];
  }

  return computeHunks(filePath, currentContent, content);
}

function computeHunks(
  filePath: string,
  oldContent: string,
  newContent: string
): Hunk[] {
  const patch = createPatch(filePath, oldContent, newContent, "", "", {
    context: 3,
  });
  const parsed = parsePatch(patch);

  if (parsed.length === 0 || !parsed[0].hunks) {
    return [];
  }

  return parsed[0].hunks.map((h, i) => ({
    index: i,
    oldStart: h.oldStart,
    oldLines: h.lines
      .filter((l) => l.startsWith("-") || l.startsWith(" "))
      .map((l) => l.slice(1)),
    newStart: h.newStart,
    newLines: h.lines
      .filter((l) => l.startsWith("+") || l.startsWith(" "))
      .map((l) => l.slice(1)),
    raw: h.lines,
  }));
}
