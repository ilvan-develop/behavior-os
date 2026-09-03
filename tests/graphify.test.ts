import { describe, it, expect } from "vitest";
import { graphifyStatus } from "../src/adapters/graphify.js";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("graphify adapter — v1.2 real knowledge layer", () => {
  it("reports configured via opencode.json mcp.graphify", () => {
    const s = graphifyStatus();
    expect(s.configured).toBe(true);
    expect(s.graphPath).toBe(join(process.cwd(), "graphify-out", "graph.json"));
  });
  it("is functional when graphify-out/graph.json exists (nodes>50, fresh)", () => {
    const s = graphifyStatus();
    // v1.2 requires real graph; bootstrap ensures it exists
    if (existsSync(s.graphPath)) {
      expect(s.functional).toBe(true);
      expect(s.nodeCount).toBeGreaterThan(50);
      expect(s.freshness).toBe("fresh");
    } else {
      expect(s.functional).toBe(false);
    }
  });
});
