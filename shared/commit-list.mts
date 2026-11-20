// Pure cap of the PR prompt's commit list: the prompt travels in a command line (Windows allows 32,767 characters).

const noteOf = (left: number, total: number): string => `(list truncated: ${left} of ${total} commits left out; run git log for more)`;

// The commit lines (subjects); the whole text, truncation note included, stays within `cap`.
export const cappedCommits = (lines: readonly string[], cap: number): string => {
  const join = (kept: readonly string[], note: string): string => [...kept, note].filter(Boolean).join("\n");
  if (join(lines, "").length <= cap) return join(lines, "");
  for (let kept = lines.length - 1; kept >= 0; kept--) {
    const text = join(lines.slice(0, kept), noteOf(lines.length - kept, lines.length));
    if (text.length <= cap) return text;
  }
  return noteOf(lines.length, lines.length);
};
