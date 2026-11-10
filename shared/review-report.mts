// What a review run printed: the text of its last `<review>…</review>` (findings, work for the plan) and of its last
// `<review-notes>…</review-notes>` (Review notes, never work). Each is empty when absent or empty.
// A missing `<review>` tag (or one never closed) is not an error: `warning` says so and the findings are empty.
export type ReviewReport = { readonly report: string; readonly notes: string; readonly warning: string };

const lastTag = (stdout: string, tag: string): string | undefined =>
  [...stdout.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].at(-1)?.[1]?.trim();

export const reviewReport = (stdout: string): ReviewReport => {
  const report = lastTag(stdout, "review");
  const notes = lastTag(stdout, "review-notes") ?? "";
  if (report === undefined) return { report: "", notes, warning: "The review printed no <review>…</review>; treated as nothing found." };
  return { report, notes, warning: "" };
};
