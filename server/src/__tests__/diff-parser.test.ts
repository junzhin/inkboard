import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { editToHunks, writeToHunks } from "../diff-parser.js";

const TMP_DIR = join(import.meta.dirname ?? ".", "__tmp_test__");
const TMP_FILE = join(TMP_DIR, "test-file.txt");

beforeEach(() => {
  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
  }
});

afterEach(() => {
  try {
    unlinkSync(TMP_FILE);
  } catch {}
});

describe("editToHunks", () => {
  it("returns hunks for a simple string replacement", () => {
    writeFileSync(TMP_FILE, "line1\nline2\nline3\n");

    const hunks = editToHunks(TMP_FILE, "line2", "LINE_TWO");

    expect(hunks.length).toBeGreaterThan(0);
    expect(hunks[0].oldLines).toContain("line2");
    expect(hunks[0].newLines).toContain("LINE_TWO");
  });

  it("returns empty array when old_string not found", () => {
    writeFileSync(TMP_FILE, "line1\nline2\nline3\n");

    const hunks = editToHunks(TMP_FILE, "nonexistent", "replacement");

    expect(hunks).toEqual([]);
  });

  it("returns empty array when old_string equals new_string", () => {
    writeFileSync(TMP_FILE, "line1\nline2\nline3\n");

    const hunks = editToHunks(TMP_FILE, "line2", "line2");

    expect(hunks).toEqual([]);
  });

  it("handles file that does not exist (new file creation via Edit)", () => {
    const nonexistent = join(TMP_DIR, "does-not-exist.txt");

    const hunks = editToHunks(nonexistent, "", "new content");

    expect(hunks.length).toBeGreaterThan(0);
    expect(hunks[0].newLines).toContain("new content");
  });

  it("handles multi-line replacement", () => {
    writeFileSync(TMP_FILE, "aaa\nbbb\nccc\nddd\neee\n");

    const hunks = editToHunks(TMP_FILE, "bbb\nccc\nddd", "BBB\nCCC");

    expect(hunks.length).toBeGreaterThan(0);
    const allNewLines = hunks.flatMap((h) => h.newLines);
    expect(allNewLines).toContain("BBB");
    expect(allNewLines).toContain("CCC");
  });
});

describe("writeToHunks", () => {
  it("returns hunks for full file replacement", () => {
    writeFileSync(TMP_FILE, "old content\n");

    const hunks = writeToHunks(TMP_FILE, "new content\n");

    expect(hunks.length).toBeGreaterThan(0);
  });

  it("returns empty array when content is identical", () => {
    writeFileSync(TMP_FILE, "same content\n");

    const hunks = writeToHunks(TMP_FILE, "same content\n");

    expect(hunks).toEqual([]);
  });

  it("handles new file creation (file does not exist)", () => {
    const nonexistent = join(TMP_DIR, "new-file.txt");

    const hunks = writeToHunks(nonexistent, "brand new file\n");

    expect(hunks.length).toBeGreaterThan(0);
    expect(hunks[0].newLines).toContain("brand new file");
  });
});
