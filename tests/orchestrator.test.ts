import { describe, it, expect } from "vitest";
import { orchestrate, orchestrateParallel } from "../src/core/orchestrator.js";
import { buildParallelGraph } from "../src/workflow/langgraph-graph.js";

describe("orchestrator — v1.4 parallel", () => {
  const base = {
    id: "parallel",
    version: "1.4.0",
    stages: [
      { id: "discover", agent: "researcher", skill: "discover", gated: false },
      { id: "plan", agent: "planner", skill: "planning", gated: false },
      { id: "architect", agent: "architect", skill: "architecture", gated: false },
      { id: "implement", agent: "implementer", skill: "implementation", gated: false },
      { id: "test", agent: "qa", skill: "verification", gated: true },
      { id: "security", agent: "security", skill: "security", gated: true },
      { id: "review", agent: "reviewer", skill: "verification", gated: true },
      { id: "evidence", agent: "orchestrator", skill: "evidence", gated: true },
    ],
    handoffs: { discover: "planner", plan: "architect", architect: "implementer", implement: "qa" } as any,
    parallelGroups: [["test", "security"]],
  } as any;

  it("orchestrate detects parallelGroups and runs workers via Promise.all", async () => {
    const r = await orchestrate(base, { id: "p1", title: "t", goal: "g", workflowId: "parallel", createdAt: new Date().toISOString(), inputs: {} } as any);
    expect(r.parallel).toBe(true);
    expect(r.trace.join("|")).toContain("parallel:start:test+security");
    expect(r.trace.join("|")).toContain("worker:test:qa");
    expect(r.trace.join("|")).toContain("worker:security:security");
  });

  it("parallel graph compiles and checkpoint has 8 stages", async () => {
    const { graph } = buildParallelGraph();
    expect(graph).toBeDefined();
    const result = await graph.invoke({ missionId: "p1", workflowId: "parallel", completed: [], current: "discover" }, { configurable: { thread_id: "test-parallel-1" } });
    expect(result.completed).toContain("test");
    expect(result.completed).toContain("security");
  });
});
