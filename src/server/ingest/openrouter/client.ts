/**
 * Thin, polite HTTP client for OpenRouter's public catalogue.
 * Bounded concurrency, timeouts and exponential backoff on 429/5xx.
 */

const BASE = "https://openrouter.ai/api/v1";
const UA = "OneAtlas-Ingest/1.0 (+https://github.com/likhith1253/AI_signal)";

export class FetchError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function getJson(path: string, { retries = 3, timeoutMs = 20_000 } = {}): Promise<unknown> {
  let attempt = 0;
  for (;;) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (res.ok) return await res.json();
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
        attempt++;
        continue;
      }
      throw new FetchError(`GET ${path} -> ${res.status}`, res.status);
    } catch (err) {
      if (err instanceof FetchError) throw err;
      if (attempt < retries) {
        await sleep(500 * 2 ** attempt);
        attempt++;
        continue;
      }
      throw new FetchError(`GET ${path} failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `fn` over items with at most `limit` in flight. Preserves input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export const openrouter = {
  models: () => getJson("/models"),
  providers: () => getJson("/providers"),
  endpoints: (externalId: string) => getJson(`/models/${externalId.split("/").map(encodeURIComponent).join("/")}/endpoints`),
};
