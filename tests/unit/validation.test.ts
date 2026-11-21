import { describe, expect, it } from "vitest";
import { compareQuery, modelListQuery, rankingsQuery, searchParamsToObject } from "@/lib/validation";
import { buildModelOrder, buildModelWhere } from "@/server/queries/models";
import { fmtPrice, fmtTokens } from "@/lib/format";

describe("query validation", () => {
  it("parses comma lists and repeated params into deduped arrays", () => {
    const sp = new URLSearchParams("lab=openai,anthropic&lab=openai&capability=tools&free=true&page=2");
    const q = modelListQuery.parse(searchParamsToObject(sp));
    expect(q.lab).toEqual(["openai", "anthropic"]);
    expect(q.capability).toEqual(["tools"]);
    expect(q.free).toBe(true);
    expect(q.page).toBe(2);
    expect(q.sort).toBe("score");
    expect(q.pageSize).toBe(24);
  });

  it("rejects out-of-range and unknown values", () => {
    expect(modelListQuery.safeParse({ pageSize: "500" }).success).toBe(false);
    expect(modelListQuery.safeParse({ sort: "drop table" }).success).toBe(false);
    expect(modelListQuery.safeParse({ type: "CHAT,BOGUS" }).success).toBe(false);
    expect(rankingsQuery.safeParse({ category: "nope" }).success).toBe(false);
  });

  it("limits comparisons to 1–4 models", () => {
    expect(compareQuery.safeParse({ models: "a,b,c,d,e" }).success).toBe(false);
    expect(compareQuery.safeParse({ models: "" }).success).toBe(false);
    expect(compareQuery.parse({ models: "a,b" }).models).toEqual(["a", "b"]);
  });
});

describe("query building", () => {
  it("excludes removed/alias models by default and combines filters with AND", () => {
    const where = buildModelWhere(modelListQuery.parse({ capability: "tools,vision", maxPrice: "2", minContext: "128000" }));
    const and = (where.AND ?? []) as object[];
    expect(and[0]).toEqual({ status: { in: ["ACTIVE", "DEPRECATED"] } });
    // one clause per capability so models must have ALL of them
    expect(and.filter((c) => "capabilities" in c)).toHaveLength(2);
    expect(and).toContainEqual({ OR: [{ isFree: true }, { blendedPrice: { lte: 2 } }] });
    expect(and).toContainEqual({ contextLength: { gte: 128000 } });
  });

  it("always puts unknown values last when sorting", () => {
    expect(buildModelOrder("input")[0]).toEqual({ minInputPrice: { sort: "asc", nulls: "last" } });
    expect(buildModelOrder("context", "asc")[0]).toEqual({ contextLength: { sort: "asc", nulls: "last" } });
    expect(buildModelOrder("score")[1]).toEqual({ slug: "asc" }); // deterministic tiebreak
  });
});

describe("formatting", () => {
  it("never renders unknown as zero", () => {
    expect(fmtPrice(null)).toBe("—");
    expect(fmtPrice(0)).toBe("Free");
    expect(fmtPrice(0.3)).toBe("$0.3");
    expect(fmtPrice(null, { variable: true })).toBe("Variable");
    expect(fmtTokens(1_048_576)).toBe("1M");
    expect(fmtTokens(131072)).toBe("131K");
  });
});
