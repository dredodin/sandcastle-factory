import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { ExtractError, extract } from "./extract.mjs";

const schema = z.object({ n: z.number() });

test("the last tag wins over earlier ones", () => {
  assert.deepEqual(extract('<out>{"n":1}</out> text <out>{"n":2}</out>', "out", schema), { n: 2 });
});

test("a body in a json fence parses", () => {
  assert.deepEqual(extract('<out>\n```json\n{"n":3}\n```\n</out>', "out", schema), { n: 3 });
});

test("no tag throws an ExtractError", () => {
  assert.throws(() => extract("nothing here", "out", schema), (error) => error instanceof ExtractError && /out/.test(error.message));
});

test("bad JSON throws an ExtractError", () => {
  assert.throws(() => extract("<out>{nope</out>", "out", schema), ExtractError);
});

test("a schema failure throws an ExtractError", () => {
  assert.throws(() => extract('<out>{"n":"x"}</out>', "out", schema), ExtractError);
});
