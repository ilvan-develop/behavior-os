import { describe, it, expect } from "vitest";
import { remember, recall, clearMemory } from "../packages/knowledge/memory.js";
import { knowledgeGraphSummary } from "../packages/knowledge/graph.js";
import { retrieve } from "../packages/knowledge/retrieval.js";

describe("knowledge — memory vs graph vs evidence", () => {
  it("memory stores and recalls", () => {
    clearMemory();
    remember({ missionId: "m1", lesson: "use graphify for discover", timestamp: new Date().toISOString(), tags: ["graph"] });
    expect(recall("m1")).toHaveLength(1);
    expect(recall("m2")).toHaveLength(0);
  });
  it("graph summary reports 207 nodes", () => {
    const g = knowledgeGraphSummary();
    expect(g.provider).toBe("graphify");
    expect(g.functional).toBe(true);
    expect(g.nodeCount).toBeGreaterThanOrEqual(207);
  });
  it("retrieval combines graph+memory+evidence", () => {
    const r = retrieve("m1");
    expect(r.graph.nodeCount).toBeGreaterThanOrEqual(207);
    expect(r.evidenceCount).toBeGreaterThan(0);
  });
});
