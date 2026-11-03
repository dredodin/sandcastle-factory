import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewReport } from "./review-report.mjs";

test("a tag with findings gives its trimmed text, the last tag winning", () => {
  assert.deepEqual(reviewReport("<review>old</review> x <review>\n- a.ts: fix\n</review>"), { report: "- a.ts: fix", warning: "" });
});

test("an empty tag is nothing found, without a warning", () => {
  assert.deepEqual(reviewReport("<review>\n</review>"), { report: "", warning: "" });
});

test("a missing or unclosed tag is nothing found, with a warning", () => {
  for (const stdout of ["no tag", "<review>never closed"]) {
    const { report, warning } = reviewReport(stdout);
    assert.equal(report, "");
    assert.match(warning, /review/);
  }
});
