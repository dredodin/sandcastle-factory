import type { z } from "zod";
import { message } from "./cli.mjs";

export class ExtractError extends Error {}

// The last <tag>…</tag> the agent printed, JSON-parsed and validated.
export const extract = <T,>(stdout: string, tag: string, schema: z.ZodType<T>): T => {
  const matches = [...stdout.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))];
  const body = matches.at(-1)?.[1];
  if (body === undefined) throw new ExtractError(`The agent printed no <${tag}>.`);
  try {
    return schema.parse(JSON.parse(body.replace(/^\s*```(?:json)?|```\s*$/g, "")));
  } catch (error) {
    throw new ExtractError(`The agent's <${tag}> is invalid: ${message(error)}`);
  }
};
