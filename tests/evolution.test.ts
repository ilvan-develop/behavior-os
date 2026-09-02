import { describe, it, expect } from "vitest";
import { proposeEvolution, applyEvolution } from "../packages/dna/evolution.js";
import type { EvaluatorResult } from "../src/core/evaluator.js";

function makeEval(overrides: Partial<EvaluatorResult> = {}): EvaluatorResult {
  return {
    approved: false,
    feedback: ["stages incomplete: 7/8"],
    coverage: { stages: { total: 8, completed: 7, pct: 87 }, governance: "pass", graphify: "functional", langgraph: "functional", overall: 90 } as any,
    iterations: 1,
    ...overrides,
  };
}

describe("dna evolution — v3.2", () => {
  it("proposes new-workflow when stages incomplete", () => {
    const p = proposeEvolution(makeEval(), ["researcher", "qa"]);
    expect(p?.kind).toBe("new-workflow");
  });
  it("returns null when evaluator approved (no evolution)", () => {
    const ok: EvaluatorResult = { approved: true, feedback: ["all criteria pass - truth verified"], coverage: { stages: { total: 8, completed: 8, pct: 100 }, governance: "pass", graphify: "functional", langgraph: "functional", overall: 100 } as any, iterations: 1 };
    expect(proposeEvolution(ok, ["researcher", "qa", "security"])).toBeNull();
    expect(applyEvolution(null)).toContain("no evolution");
  });
  it("applies evolution patch", () => {
    const p = proposeEvolution(makeEval(), ["a"]);
    expect(applyEvolution(p)).toContain("evolution:");
  });
});
