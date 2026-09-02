import { describe, it, expect } from "vitest";
import { allBehaviors, getBehavior } from "../src/core/behavior-kernel.js";
import { buildContext } from "../packages/kernel/context.js";
import { canTransition, nextState } from "../packages/kernel/lifecycle.js";
import { emit, getEvents, clearEvents } from "../packages/kernel/events.js";
import { validateStage } from "../packages/kernel/contracts.js";

describe("kernel", () => {
  it("has 8 behaviors total", () => {
    expect(allBehaviors()).toHaveLength(8);
  });
  it("finds atomic observe", () => {
    expect(getBehavior("observe")?.kind).toBe("atomic");
  });
  it("returns undefined for unknown", () => {
    expect(getBehavior("unknown")).toBeUndefined();
  });
  it("context builds with graph summary", () => {
    const ctx = buildContext({ id: "m1", title: "t", goal: "g", workflowId: "development", createdAt: new Date().toISOString(), inputs: {} } as any, "discover", ["every_mission_has_evidence"]);
    expect(ctx.stage).toBe("discover");
    expect(ctx.invariants).toContain("every_mission_has_evidence");
  });
  it("lifecycle transitions correctly", () => {
    expect(canTransition("created", "discovery")).toBe(true);
    expect(canTransition("created", "completed")).toBe(false);
    expect(nextState("created", "workflow.started")).toBe("discovery");
    expect(nextState("executing", "blocked")).toBe("blocked");
  });
  it("events bus records and filters", () => {
    clearEvents();
    emit({ type: "mission.created", missionId: "m1", timestamp: new Date().toISOString() });
    emit({ type: "workflow.completed", missionId: "m1", timestamp: new Date().toISOString() });
    expect(getEvents("m1")).toHaveLength(2);
    expect(getEvents("m2")).toHaveLength(0);
  });
  it("stage contract validates", () => {
    const r = validateStage({ id: "discover", input: ["mission"], actor: "researcher", capabilities: ["read"], constraints: [], output: ["findings"], acceptance: ["ok"], evidence: ["findings.md"], next: "plan", failure: "blocked" });
    expect(r.valid).toBe(true);
  });
});
