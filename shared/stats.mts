// Durations of phases and setup.sh on this machine, pure: `<phase kind or setup.sh> <repo>` → the latest successful durations in ms, oldest first.

import prettyMs from "pretty-ms";
import { z } from "zod";

export type Stats = Readonly<Record<string, readonly number[]>>;

// Enough for a stable median; old runs age out as repos and agents change.
const KEPT = 50;

const statsSchema = z.record(z.string(), z.array(z.number().nonnegative()));

export const parseStats = (text: string): Stats => statsSchema.parse(JSON.parse(text));

export const median = (samples: readonly number[]): number => {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

export const isSlow = (samples: readonly number[], ms: number): boolean => samples.length > 0 && ms > 2 * median(samples);

export const withSample = (stats: Stats, key: string, ms: number): Stats => ({ ...stats, [key]: [...(stats[key] ?? []), ms].slice(-KEPT) });

// ` (median <d>)`, `, slow` added past twice the median; "" with no samples yet.
export const baselineText = (samples: readonly number[], ms: number): string =>
  samples.length === 0 ? "" : ` (median ${prettyMs(median(samples))}${isSlow(samples, ms) ? ", slow" : ""})`;
