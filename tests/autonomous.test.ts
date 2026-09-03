import { describe, it, expect, vi } from "vitest";

vi.mock("../src/adapters/graphify.js", () => ({
  graphifyStatus: vi.fn(() => ({
    configured: true,
    functional: true,
    graphPath: "graphify-out/graph.json",
    freshness: "fresh" as const,
    nodeCount: 207,
  })),
  graphifyQuery: vi.fn(() => "mocked"),
  graphifyMcpCommand: vi.fn(() => ["python", "-m", "graphify.serve", "graphify-out/graph.json"]),
}));

import { runAutonomous } from "../src/core/autonomous.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("autonomous — v2.0 Development OS", () => {
  it("runs chain development + parallel autonomously", async () => {
    const r = await runAutonomous("autonomous-demo");
    expect(r.overall).toBe("COMPLETED");
    expect(r.missions).toContain("demo");
    expect(r.missions).toContain("parallel-demo");
    expect(r.evidences).toHaveLength(2);
  });

  it("writes aggregated evidence autonomous-demo.json", async () => {
    await runAutonomous("autonomous-demo");
    const p = join(process.cwd(), "behavior-os", "runtime", "autonomous-demo.json");
    expect(existsSync(p)).toBe(true);
    const j = JSON.parse(readFileSync(p, "utf-8"));
    expect(j.autonomous).toBe(true);
    expect(j.overall).toBe("COMPLETED");
    expect(j.missions).toContain("demo");
  });
});
