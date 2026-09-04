/**
 * Runs `mapper` over `items`, at most `concurrency` calls in flight at once,
 * instead of firing every call in the same instant.
 *
 * A bulk action wired straight to `Promise.all(rows.map(...))` sends the
 * whole selection to the server in a single burst — thirty bays taken out
 * of service becomes thirty simultaneous requests, and the API's rate
 * limiter exists exactly to catch that. Selecting a large page and running
 * a bulk status change came back `RATE_LIMITED` partway through, with no
 * way to tell which rows actually went through. Capping how many are in
 * flight at once keeps a large selection under the limit without the
 * caller having to know what that limit is.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
