import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { searchParamsToObject } from "./validation";

/**
 * Consistent API envelope:
 *   200 { data, meta? }
 *   4xx/5xx { error: { code, message, details? } }
 */
export function ok<T>(data: T, meta?: Record<string, unknown>, init?: { revalidate?: number }) {
  const res = NextResponse.json(meta ? { data, meta } : { data });
  const ttl = init?.revalidate ?? 300;
  if (ttl > 0) res.headers.set("Cache-Control", `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 6}`);
  else res.headers.set("Cache-Control", "no-store");
  return res;
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers: { "Cache-Control": "no-store" } });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function parseQuery<T>(schema: ZodType<T>, url: string | URL): T {
  const sp = new URL(url).searchParams;
  return schema.parse(searchParamsToObject(sp));
}

/** Wrap a route handler: validation errors -> 400, HttpError -> status, anything else -> 500 (logged, not leaked). */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    const limited = rateLimit(req);
    if (limited) return limited;
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        return fail(400, "invalid_request", "Query parameters failed validation", err.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      }
      if (err instanceof HttpError) return fail(err.status, err.code, err.message);
      console.error(JSON.stringify({ level: "error", route: new URL(req.url).pathname, message: (err as Error).message }));
      return fail(500, "internal_error", "Something went wrong while handling this request");
    }
  };
}
// Fixed-window limiter per client IP. Best-effort: state is per server instance,
// which is adequate for abuse protection on a read-only public API. A shared
// store (e.g. Upstash Redis) can replace `buckets` without changing callers.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(req: Request, max = MAX_REQUESTS, scope = "api"): Response | null {
  const ip = `${scope}:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local"}`;
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.reset < now) {
    buckets.set(ip, { count: 1, reset: now + WINDOW_MS });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return null;
  }
  b.count++;
  if (b.count > max) {
    const res = fail(429, "rate_limited", "Too many requests, slow down");
    res.headers.set("Retry-After", String(Math.ceil((b.reset - now) / 1000)));
    return res;
  }
  return null;
}

/** Constant-time bearer token check for protected operations. */
export function requireBearer(req: Request, secret: string | undefined) {
  if (!secret) throw new HttpError(503, "not_configured", "This operation is not configured on the server");
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.length !== secret.length) throw new HttpError(401, "unauthorized", "Missing or invalid bearer token");
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  if (diff !== 0) throw new HttpError(401, "unauthorized", "Missing or invalid bearer token");
}
