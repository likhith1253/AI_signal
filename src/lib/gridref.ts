/** The OneAtlas datum. */
export const DATUM = {
  priceMin: 0.01,
  priceMax: 100,
  intelMin: 0,
  intelMax: 80,
  cols: "ABCDEFGHJKLM".split(""),
  rows: 8,
} as const;

/** Normalised sheet position: u ∈ [0,1] left→right, v ∈ [0,1] top→bottom. */
export function project(price: number, intelligence: number): { u: number; v: number } {
  const lp = Math.log10(Math.min(DATUM.priceMax, Math.max(DATUM.priceMin, price)));
  const u = (lp - Math.log10(DATUM.priceMin)) / (Math.log10(DATUM.priceMax) - Math.log10(DATUM.priceMin));
  const iv = Math.min(DATUM.intelMax, Math.max(DATUM.intelMin, intelligence));
  const v = 1 - (iv - DATUM.intelMin) / (DATUM.intelMax - DATUM.intelMin);
  return { u, v };
}

/** "F3", with a two-digit sub-square easting/northing: "F3·47". */
export function gridRef(price: number | null | undefined, intelligence: number | null | undefined): string | null {
  if (price == null || price <= 0 || intelligence == null) return null;
  const { u, v } = project(price, intelligence);
  const cx = Math.min(DATUM.cols.length - 1, Math.floor(u * DATUM.cols.length));
  const ry = Math.min(DATUM.rows - 1, Math.floor(v * DATUM.rows));
  const subE = Math.min(9, Math.floor((u * DATUM.cols.length - cx) * 10));
  const subN = Math.min(9, Math.floor((v * DATUM.rows - ry) * 10));
  return `${DATUM.cols[cx]}${ry + 1}·${subE}${subN}`;
}

/** Named regions of the sheet, used as map labels and in prose. */
export function regionName(price: number, intelligence: number): string {
  const { u, v } = project(price, intelligence);
  if (v < 0.5) return u < 0.5 ? "Value highlands" : "Premium summit";
  return u < 0.5 ? "Budget lowlands" : "Costly shallows";
}
