import type { z } from "zod";

// The last <tag>…</tag> the agent printed, JSON-parsed and validated.
export const extract = <T,>(stdout: string, tag: string, schema: z.ZodType<T>): T => {
  const matches = [...stdout.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))];
  const body = matches.at(-1)?.[1];
  if (body === undefined) throw new Error(`The agent printed no <${tag}>.`);
  return schema.parse(JSON.parse(body.replace(/^\s*```(?:json)?|```\s*$/g, "")));
};
