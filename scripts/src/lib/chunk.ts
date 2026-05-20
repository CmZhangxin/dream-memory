import matter from "gray-matter";

const MIN_CHUNK_LEN = 30;
const MAX_CHUNK_LEN = 2000;

/**
 * Split a markdown document into capture-friendly chunks.
 *
 * Steps:
 *  1. Strip frontmatter (gray-matter)
 *  2. Split by blank lines
 *  3. Drop chunks < 30 chars
 *  4. Truncate chunks > 2000 chars (append [TRUNCATED:N])
 */
export function chunkMarkdown(md: string): string[] {
  let body = md;
  try {
    body = matter(md).content;
  } catch {
    // frontmatter parse failed; treat whole file as body
  }
  return body
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_CHUNK_LEN)
    .map((s) => {
      if (s.length <= MAX_CHUNK_LEN) return s;
      return s.slice(0, MAX_CHUNK_LEN) + `\n\n[TRUNCATED:${s.length - MAX_CHUNK_LEN}]`;
    });
}
