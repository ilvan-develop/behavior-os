import { describe, it, expect } from "vitest";
import { evaluateEvidence, evaluatorOptimizer } from "../src/core/evaluator.js";
import type { Evidence, Mission } from "../src/domain/types.js";

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    missionId: "m1",
    workflowId: "development",
    status: "COMPLETED",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    stages: [
      { stage: "discover", status: "COMPLETED" },
      { stage: "plan", status: "COMPLETED" },
      { stage: "architect", status: "COMPLETED" },
      { stage: "implement", status: "COMPLETED" },
      { stage: "test", status: "COMPLETED" },
      { stage: "security", status: "COMPLETED" },
      { stage: "review", status: "COMPLETED" },
      { stage: "evidence", status: "COMPLETED" },
    ],
    governance: { policyId: "default", verdict: "pass", reasons: ["ok"] },
    graphify: { graphPath: "graphify-out/graph.json", exists: true, nodeCount: 207 },
    langgraph: { available: true, reason: "ok", compiled: true, nodeCount: 8, threadId: "t" },
    ...overrides,
  };
}

const mission = { id: "m1", title: "t", goal: "g", workflowId: "development", createdAt: new Date().toISOString(), inputs: {} } as Mission;

describe("evaluator — v1.5 truth/coverage", () => {
  it("approves when all criteria pass (100% coverage)", () => {
    const r = evaluateEvidence(mission, makeEvidence());
    expect(r.approved).toBe(true);
    expect(r.coverage.overall).toBe(100);
    expect(r.coverage.graphify).toBe("functional");
  });

  it("fails when stages incomplete", () => {
    const e = makeEvidence({ stages: [{ stage: "discover", status: "FAILED" } as any] });
    const r = evaluateEvidence(mission, e);
    expect(r.approved).toBe(false);
    expect(r.feedback.join()).toContain("stages incomplete");
  });

  it("evaluatorOptimizer loops max 3 and returns approved when evidence good", async () => {
    const r = await evaluatorOptimizer(mission, () => makeEvidence(), 3);
    expect(r.approved).toBe(true);
    expect(r.iterations).toBe(1);
  });
});
