import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewReport } from "./review-report.mjs";

test("a tag with findings gives its trimmed text, the last tag winning", () => {
  assert.deepEqual(reviewReport("<review>old</review> x <review>\n- a.ts: fix\n</review>"), { findings: "- a.ts: fix", notes: "", warning: "" });
});

test("an empty tag is nothing found, without a warning", () => {
  assert.deepEqual(reviewReport("<review>\n</review>"), { findings: "", notes: "", warning: "" });
});

test("a missing or unclosed tag is nothing found, with a warning", () => {
  for (const stdout of ["no tag", "<review>never closed"]) {
    const { findings, warning } = reviewReport(stdout);
    assert.equal(findings, "");
    assert.match(warning, /review/);
  }
});

test("Review notes come apart from findings: only notes leave the findings empty", () => {
  assert.deepEqual(reviewReport("<review></review>\n<review-notes>\n- a.ts:3 — note\n</review-notes>"), { findings: "", notes: "- a.ts:3 — note", warning: "" });
});

test("a review-notes tag is not read as the review tag", () => {
  assert.equal(reviewReport("<review>f</review><review-notes>n</review-notes>").findings, "f");
});
