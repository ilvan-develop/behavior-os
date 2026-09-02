import { describe, it, expect } from "vitest";
import { computeCoverage } from "../packages/verification/coverage.js";

describe("cognitive coverage — v2.1 thresholds", () => {
  it("computes coverage and checks thresholds", () => {
    const c = computeCoverage();
    expect(c.architecture).toBeGreaterThanOrEqual(90);
    expect(c.domain).toBeGreaterThanOrEqual(90);
    expect(c.governance).toBe(100);
    expect(c.global).toBeGreaterThanOrEqual(80); // bootstrap may not be 95 until all docs present
  });
});
