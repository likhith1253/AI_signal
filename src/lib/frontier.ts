/**
 * Cost-to-capability Pareto frontier.
 * A model is on the frontier when no other model is both cheaper (or equal)
 * and at least as capable, with one of them strictly better.
 */
export interface FrontierPoint {
  slug: string;
  price: number;
  intelligence: number;
}

export function paretoFrontier<T extends FrontierPoint>(points: T[]): T[] {
  const sorted = [...points].filter((p) => p.price > 0 && Number.isFinite(p.intelligence)).sort((a, b) => a.price - b.price || b.intelligence - a.intelligence);
  const out: T[] = [];
  let best = -Infinity;
  for (const p of sorted) {
    if (p.intelligence > best) {
      out.push(p);
      best = p.intelligence;
    }
  }
  return out;
}

/** How far below the frontier a model sits: frontier intelligence available at <= its price, minus its own. */
export function frontierGap<T extends FrontierPoint>(p: T, frontier: T[]): number {
  let best = -Infinity;
  for (const f of frontier) if (f.price <= p.price) best = Math.max(best, f.intelligence);
  return best === -Infinity ? 0 : Math.max(0, best - p.intelligence);
}
