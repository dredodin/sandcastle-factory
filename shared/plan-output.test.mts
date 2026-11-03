import assert from "node:assert/strict";
import { test } from "node:test";
import { planOutputSchema } from "./plan-output.mjs";

const schema = planOutputSchema([{ name: "app", slug: "o/app" }]);

test("rejected findings carry a reason; absent means none", () => {
  const parsed = schema.parse({ items: [{ work: "fix a.ts", repo: "app", title: "t" }], rejected: [{ finding: "x", reason: "contradicts ADR-0001" }] });
  assert.deepEqual(parsed.rejected, [{ finding: "x", reason: "contradicts ADR-0001" }]);
  assert.deepEqual(schema.parse({ items: [] }).rejected, []);
});

test("a rejection without a reason is refused", () => {
  assert.throws(() => schema.parse({ items: [], rejected: [{ finding: "x", reason: "" }] }));
});

test("an item with both or neither of issue and work is refused", () => {
  assert.throws(() => schema.parse({ items: [{ issue: "1", work: "w", repo: "app", title: "t" }] }));
  assert.throws(() => schema.parse({ items: [{ repo: "app", title: "t" }] }));
});

test("an item outside the Workspace is refused", () => {
  assert.throws(() => schema.parse({ items: [{ work: "w", repo: "other", title: "t" }] }));
});
