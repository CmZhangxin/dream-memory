import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chunkMarkdown } from "../../src/lib/chunk.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

describe("chunkMarkdown", () => {
  it("strips frontmatter and splits paragraphs", async () => {
    const md = await readFile(join(__dirname, "../_fixtures/sample-note.md"), "utf-8");
    const chunks = chunkMarkdown(md);
    // 期望: 两个长段落（标题行和"太短"都被 < 30 字符过滤掉）
    expect(chunks.length).toBe(2);
    expect(chunks.some((c) => c.includes("title: Sample"))).toBe(false); // frontmatter 已剥
    expect(chunks.some((c) => c.includes("太短"))).toBe(false); // 短段过滤
    expect(chunks.some((c) => c.includes("第一段"))).toBe(true);
    expect(chunks.some((c) => c.includes("第二段"))).toBe(true);
  });

  it("filters out empty chunks", () => {
    const chunks = chunkMarkdown("\n\n\n\n");
    expect(chunks).toEqual([]);
  });

  it("filters chunks shorter than 30 chars", () => {
    const chunks = chunkMarkdown("a\n\nbb\n\n" + "x".repeat(50));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatch(/^x{50}$/);
  });

  it("truncates chunks over 2000 chars", () => {
    const huge = "y".repeat(3000);
    const chunks = chunkMarkdown(huge);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.length).toBeLessThanOrEqual(2050);
    expect(chunks[0]!).toContain("[TRUNCATED");
  });
});
