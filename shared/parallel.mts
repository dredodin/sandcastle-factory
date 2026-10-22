import { message } from "./cli.mjs";

const MAX_PARALLEL = 4;

// Runs `work` over the items, at most MAX_PARALLEL at a time, and returns the results in item order.
// Every item runs to its end even if another fails; then one error names all the failed items.
export const inParallel = async <T, R>(
  items: readonly T[],
  name: (item: T) => string,
  work: (item: T) => Promise<R>,
): Promise<readonly R[]> => {
  // The one shared state: workers take the next item from it until it is empty.
  const queue = items.map((item, index) => ({ item, index }));
  type Done = { readonly index: number; readonly outcome: PromiseSettledResult<R> };
  const worker = async (): Promise<readonly Done[]> => {
    const next = queue.shift();
    if (!next) return [];
    const outcome = await work(next.item).then(
      (value) => ({ status: "fulfilled", value }) as const,
      (reason: unknown) => ({ status: "rejected", reason }) as const,
    );
    return [{ index: next.index, outcome }, ...(await worker())];
  };
  const done = (await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, items.length) }, worker))).flat().sort((a, b) => a.index - b.index);

  const values = done.flatMap(({ outcome }) => (outcome.status === "fulfilled" ? [outcome.value] : []));
  if (values.length === items.length) return values;
  const failures = done.flatMap(({ index, outcome }) => (outcome.status === "rejected" ? [`  ${name(items[index]!)}: ${message(outcome.reason)}`] : []));
  throw new Error(`Failed items:\n${failures.join("\n")}`);
};
