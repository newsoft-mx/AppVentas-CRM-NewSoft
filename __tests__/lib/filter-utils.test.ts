import { buildDateOrFilters, matchPeriod } from "@/lib/filter-utils";

describe("filter-utils date filters", () => {
  it("uses UTC boundaries so Jan 1 UTC does not match the previous year", () => {
    expect(matchPeriod("2026-01-01T00:00:00.000Z", { ano: [2025], q: [], mes: [] })).toBe(false);
    expect(matchPeriod("2026-01-01T00:00:00.000Z", { ano: [2026], q: [], mes: [] })).toBe(true);
  });

  it("builds year ranges at UTC midnight", () => {
    const [range] = buildDateOrFilters({ ano: [2025], q: [], mes: [] });

    expect(range.gte.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
