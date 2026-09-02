import { describe, it, expect } from "vitest";
import { generateWorkflow } from "../packages/orchestrator/workflow-generator.js";
import { planTeam } from "../packages/orchestrator/planner.js";

describe("workflow-generator — v3.1 ephemeral", () => {
  it("generates workflow for checkout team", () => {
    const team = planTeam("Implementar checkout multi-tenant");
    const wf = generateWorkflow("M-001", team);
    expect(wf.id).toBe("wf-M-001");
    expect(wf.stages[0].id).toBe("discover");
    expect(wf.stages[wf.stages.length - 1].agent).toBe("orchestrator");
    expect(wf.handoffs["discover"]).toBeDefined();
  });
  it("generates parallel group when qa+security present", () => {
    const wf = generateWorkflow("M-002", ["researcher", "qa", "security", "orchestrator"]);
    expect(wf.parallelGroups).toEqual([["test", "security"]]);
  });
  it("orchestrates any team (mobile+devops future)", () => {
    const team = planTeam("Build mobile app", ["mobile", "devops"]);
    const wf = generateWorkflow("M-003", team);
    expect(wf.stages.map(s=>s.agent)).toContain("mobile");
    expect(wf.stages.map(s=>s.agent)).toContain("devops");
  });
});
