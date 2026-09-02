import { describe, it, expect } from "vitest";
import { langGraphStatus, verifyLangGraphCheckpoint } from "../src/adapters/langgraph.js";
import { buildBehaviorGraph, runBehaviorGraph } from "../src/workflow/langgraph-graph.js";

describe("langgraph — v1.3 real durable runtime", () => {
  it("status reports functional with 8 nodes", () => {
    const s = langGraphStatus();
    expect(s.available).toBe(true);
    expect(s.compiled).toBe(true);
    expect(s.nodeCount).toBe(8);
  });

  it("builds StateGraph and compiles", () => {
    const { graph } = buildBehaviorGraph();
    expect(graph).toBeDefined();
  });

  it("runs graph and checkpoint persists", async () => {
    const { checkpoint } = await runBehaviorGraph("test-lg", "development", "thread-test-lg");
    expect(checkpoint.values.completed).toContain("evidence");
    expect(checkpoint.values.completed).toHaveLength(8);
  });

  it("verify helper confirms checkpoint", async () => {
    const ok = await verifyLangGraphCheckpoint("thread-verify-lg");
    expect(ok).toBe(true);
  });
});
