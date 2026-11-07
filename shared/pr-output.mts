import { z } from "zod";
import { message } from "./cli.mjs";
import { extract } from "./extract.mjs";

const pullRequestSchema = z.object({ url: z.url() });

export class PrOutputError extends Error {}

// The PR url the agent printed; a missing tag or a bad url is a PrOutputError.
export const prUrl = (stdout: string, repoName: string): string => {
  try {
    return extract(stdout, "pull-request", pullRequestSchema).url;
  } catch (error) {
    throw new PrOutputError(`PR output of ${repoName} missing or invalid: ${message(error)}`);
  }
};
