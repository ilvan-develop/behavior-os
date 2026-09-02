import { describe, it, expect } from "vitest";
import { discoverSelfEvolution } from "../packages/orchestrator/self-evolution.js";

describe("self-evolution discovery — v3.4 (no write)", () => {
  it("discovers gaps without writing files", () => {
    const r = discoverSelfEvolution("demo");
    expect(r.missionId).toBe("demo");
    expect(r.coverage).toBeDefined();
    expect(Array.isArray(r.gaps)).toBe(true);
    expect(Array.isArray(r.proposals)).toBe(true);
  });
  it("reports coverage and does not mutate runtime", () => {
    const r = discoverSelfEvolution("nonexistent-mission-xyz");
    expect(r.gaps).toContain("no evidence for mission");
  });
});
