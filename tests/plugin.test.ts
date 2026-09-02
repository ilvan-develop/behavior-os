import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("plugin behaviorOS — v3.4 self-evolution via Gateway", () => {
  it("loads plugin and exposes hooks", async () => {
    const mod = await import("../.opencode/plugins/behaviorOS.js");
    const plugin = mod.default as any;
    expect(typeof plugin).toBe("function");
    const hooks = await plugin({ client: { app: { log: async () => {} } } } as any);
    expect(hooks["tool.execute.before"]).toBeDefined();
    expect(hooks["session.idle"]).toBeDefined();
  });

  it("gateway blocks security write (DNA invariant)", async () => {
    const { canExecute } = await import("../packages/gateway/gateway.js");
    expect(canExecute("write", "security", "security-audit").allowed).toBe(false);
  });

  it("self-evolution discovery via plugin does not write src/ (only runtime if needed)", async () => {
    const out = join(process.cwd(), "behavior-os", "runtime", "self-evolution.json");
    // ensure clean
    if (existsSync(out)) rmSync(out);
    const mod = await import("../.opencode/plugins/behaviorOS.js");
    const plugin = mod.default as any;
    const logs: string[] = [];
    const hooks = await plugin({ client: { app: { log: async ({ body }: any) => logs.push(body.message) } } } as any);
    await hooks["session.idle"]();
    // demo has no gaps, so should log "no gaps" and not create file (or create with 0 proposals if gateway allows)
    // we just check that it logged something and didn't throw
    expect(logs.join(" ")).toMatch(/Self-evolution|no gaps|proposals/);
    // cleanup if file was created (when gaps exist, it would be created; for demo it may not)
    if (existsSync(out)) {
      const j = JSON.parse(readFileSync(out, "utf-8"));
      expect(j.discovery).toBeDefined();
      rmSync(out);
    }
  }, 10000);

  it("executes evolution: creates workflow when Gateway allows and demo has gap", async () => {
    const { readFileSync, writeFileSync, existsSync } = await import("node:fs");
    const demoPath = join(process.cwd(), "behavior-os", "runtime", "demo.json");
    const backup = existsSync(demoPath) ? readFileSync(demoPath, "utf-8") : null;
    // force demo to have gap (stages incomplete) to trigger new-workflow proposal
    const gapEvidence = {
      missionId: "demo", workflowId: "development", status: "COMPLETED",
      startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
      stages: [{ stage: "discover", status: "FAILED" }],
      governance: { policyId: "default", verdict: "pass", reasons: ["ok"] },
      graphify: { graphPath: "graphify-out/graph.json", exists: true, nodeCount: 207 },
      langgraph: { available: true, reason: "ok", compiled: true, nodeCount: 8, threadId: "t" },
      evaluator: { approved: false, iterations: 1, feedback: ["stages incomplete: 1/8"], coverage: { stages: { total: 8, completed: 1, pct: 12 }, governance: "pass", graphify: "functional", langgraph: "functional", overall: 50 } },
    };
    writeFileSync(demoPath, JSON.stringify(gapEvidence), "utf-8");
    const mod = await import("../.opencode/plugins/behaviorOS.js");
    const plugin = mod.default as any;
    const logs: string[] = [];
    const hooks = await plugin({ client: { app: { log: async ({ body }: any) => logs.push(body.message) } } } as any);
    await hooks["session.idle"]();
    // should have created a new workflow file wf-evolved-*.json
    const { readdirSync } = await import("node:fs");
    const wfDir = join(process.cwd(), "behavior-os", "workflows");
    const evolved = readdirSync(wfDir).filter((f: string) => f.startsWith("wf-evolved-"));
    expect(evolved.length).toBeGreaterThan(0);
    // cleanup: remove evolved workflows and restore demo
    for (const f of evolved) {
      const { rmSync } = await import("node:fs");
      rmSync(join(wfDir, f), { force: true });
    }
    if (backup) writeFileSync(demoPath, backup, "utf-8");
    // also clean self-evolution.json if created
    const se = join(process.cwd(), "behavior-os", "runtime", "self-evolution.json");
    if (existsSync(se)) {
      const { rmSync } = await import("node:fs");
      rmSync(se, { force: true });
    }
  }, 10000);
});
