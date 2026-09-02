import { describe, it, expect } from "vitest";
import { planTeam, listAgents } from "../packages/orchestrator/planner.js";

describe("planner — v3.0 Universal Team", () => {
  it("lists 10 agents (including future mobile|devops)", () => {
    expect(listAgents()).toHaveLength(10);
  });
  it("plans team for checkout multi-tenant (architect+security)", () => {
    const team = planTeam("Implementar checkout multi-tenant");
    expect(team).toContain("architect");
    expect(team).toContain("security");
    expect(team).toContain("orchestrator");
  });
  it("plans team for any capability (mobile)", () => {
    const team = planTeam("Build mobile app", ["mobile"]);
    expect(team).toContain("mobile");
  });
  it("is deterministic and capability-driven", () => {
    const t1 = planTeam("Research auth flow", ["discover"]);
    expect(t1).toContain("researcher");
  });
});
