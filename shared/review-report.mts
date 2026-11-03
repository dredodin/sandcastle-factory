// What a review run printed: the text of its last `<review>…</review>`. Empty when it found nothing.
// A missing tag (or one never closed) is not an error: `warning` says so and the report is empty.
export type ReviewReport = { readonly report: string; readonly warning: string };

export const reviewReport = (stdout: string): ReviewReport => {
  const body = [...stdout.matchAll(/<review>([\s\S]*?)<\/review>/g)].at(-1)?.[1];
  if (body === undefined) return { report: "", warning: "The review printed no <review>…</review>; treated as nothing found." };
  return { report: body.trim(), warning: "" };
};
