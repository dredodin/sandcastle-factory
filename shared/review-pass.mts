export type AfterReview = "review" | "pr";

// After review pass `pass` and the cycles that followed it: review again, or open the PRs.
// A run has two review passes at most, and a review that filed nothing plans nothing.
export const afterReview = (pass: number, planned: boolean): AfterReview => (pass === 1 && planned ? "review" : "pr");
