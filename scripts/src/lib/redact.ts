const PATTERNS: Array<{ name: string; re: RegExp; replacement: string }> = [
  { name: "openai-key", re: /sk-[A-Za-z0-9_-]{20,}/g, replacement: "[REDACTED:KEY]" },
  { name: "github-token", re: /gh[pousr]_[A-Za-z0-9]{36,}/g, replacement: "[REDACTED:TOKEN]" },
  { name: "password-kv", re: /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi, replacement: "[REDACTED:PASSWORD]" },
  { name: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replacement: "[REDACTED:EMAIL]" },
  { name: "phone-cn", re: /(?<!\d)1[3-9]\d{9}(?!\d)/g, replacement: "[REDACTED:PHONE]" },
];

export interface RedactResult {
  text: string;
  hits: Record<string, number>;
}

export function redact(input: string): RedactResult {
  let text = input;
  const hits: Record<string, number> = {};
  for (const { name, re, replacement } of PATTERNS) {
    let count = 0;
    text = text.replace(re, () => {
      count++;
      return replacement;
    });
    if (count > 0) hits[name] = count;
  }
  return { text, hits };
}
