// Pure cap of the PR prompt's commit list: the prompt travels in a command line (Windows allows 32,767 characters).

const LINE_MAX = 200;

const noteOf = (left: number, total: number): string => `(list truncated: ${left} of ${total} commits left out; run git log for more)`;

// The commit lines (subjects), each cut to 200 characters; the whole text, truncation note included, stays within `cap`.
export const cappedCommits = (lines: readonly string[], cap: number): string => {
  const cut = lines.map((line) => line.slice(0, LINE_MAX));
  const join = (kept: readonly string[], note: string): string => [...kept, note].filter(Boolean).join("\n");
  if (join(cut, "").length <= cap) return join(cut, "");
  for (let kept = cut.length - 1; kept >= 0; kept--) {
    const text = join(cut.slice(0, kept), noteOf(cut.length - kept, cut.length));
    if (text.length <= cap) return text;
  }
  return noteOf(cut.length, cut.length);
};
