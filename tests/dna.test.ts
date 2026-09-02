import { describe, it, expect } from "vitest";
import { loadSystemDna, loadProjectDna, loadAgentDna } from "../packages/dna/loader.js";
import { resolveDna, checkInvariant } from "../packages/dna/resolver.js";
import { validateDna } from "../packages/dna/validator.js";

describe("dna — hereditary invariants", () => {
  it("loads system dna with required invariants", () => {
    const sys = loadSystemDna();
    expect(sys).not.toBeNull();
    expect((sys as any).invariants).toContain("every_mission_has_evidence");
  });
  it("loads project dna", () => {
    const proj = loadProjectDna();
    expect(proj).not.toBeNull();
  });
  it("resolves effective dna System+Project+Workflow+Agent", () => {
    const eff = resolveDna("security", "development");
    expect(eff.principles).toContain("evidence_driven");
    expect(eff.invariants).toContain("no_unverified_completion");
    expect(eff.invariants).toContain("cannot_approve_own_security_review");
    expect(checkInvariant(eff, "every_mission_has_evidence")).toBe(true);
  });
  it("validates required invariants", () => {
    const eff = resolveDna("security", "development");
    const v = validateDna(eff);
    expect(v.valid).toBe(true);
  });
  it("loads agent dna", () => {
    const ag = loadAgentDna("security");
    expect(ag).not.toBeNull();
  });
});
