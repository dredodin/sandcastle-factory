// What a review run printed: the text of its last `<review>…</review>` (findings, work for the plan) and of its last
// `<review-notes>…</review-notes>` (Review notes, never work). Each is empty when absent or empty.
// A missing `<review>` tag (or one never closed) is not an error: `warning` says so and the findings are empty.
export type ReviewReport = { readonly findings: string; readonly notes: string; readonly warning: string };

// What one review pass keeps of a report: its findings and Review notes.
export type ReviewPass = Pick<ReviewReport, "findings" | "notes">;

const lastTag = (stdout: string, tag: string): { readonly found: boolean; readonly body: string } => {
  const last = [...stdout.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].at(-1);
  return { found: last !== undefined, body: last?.[1]?.trim() ?? "" };
};

export const reviewReport = (stdout: string): ReviewReport => {
  const review = lastTag(stdout, "review");
  const { body: notes } = lastTag(stdout, "review-notes");
  if (!review.found) return { findings: "", notes, warning: "The review printed no <review>…</review>; treated as nothing found." };
  return { findings: review.body, notes, warning: "" };
};
