import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  defaultPolicy,
  protectedPathsPolicy,
  riskGovernancePolicy,
  behaviorLevelPolicy,
  evaluateAll,
} from "../src/domain/policies.js";
import { govern, governanceForWorkflow } from "../src/core/governance.js";
import type { Mission } from "../src/domain/types.js";

function makeMission(over: Partial<Record<string, unknown>> = {}): Mission {
  return {
    id: "m-bl",
    title: "Behavior Level Mission",
    goal: "test",
    workflowId: "development",
    createdAt: new Date().toISOString(),
    inputs: {},
    ...over,
  } as Mission;
}

const WF_DIR = join(process.cwd(), "behavior-os", "workflows");

/** All 18 workflow ids declared in behavior-os/workflows must have a known behavior level. */
const ALL_WORKFLOW_IDS = [
  "architecture",
  "autonomous",
  "brainstorm",
  "bugfix",
  "development",
  "evolve",
  "feature",
  "incident",
  "learn",
  "migration",
  "parallel",
  "refactor",
  "release",
  "research",
  "security-audit",
  "wf-LEARN-EXEC",
  "wf-enterprise-rbac",
  "wf-evolution-dna-governance",
];

describe("behavior-level policy — fail-closed coverage of all workflows", () => {
  it("behaviorLevelPolicy knows every declared workflow id (no unknown → allow)", () => {
    for (const wf of ALL_WORKFLOW_IDS) {
      const v = behaviorLevelPolicy.check(makeMission({ workflowId: wf }));
      expect(v.allowed).toBe(true);
      expect(v.reasons.join(" ")).not.toContain("unknown workflow");
      expect(v.reasons.join(" ")).toMatch(/behavior level \d/);
    }
  });

  it("govern() composite never returns unknown-workflow allow for declared workflows", () => {
    for (const wf of ALL_WORKFLOW_IDS) {
      const v = govern(makeMission({ workflowId: wf }));
      expect(v.allowed).toBe(true);
      expect(v.reasons.join(" ")).not.toContain("unknown workflow");
    }
  });

  it("high risk without approval is blocked on level >= 5 workflows", () => {
    for (const wf of ["development", "feature", "parallel", "migration", "security-audit", "wf-enterprise-rbac", "wf-evolution-dna-governance"]) {
      const v = behaviorLevelPolicy.check(makeMission({ workflowId: wf, risk: "high" }));
      expect(v.allowed).toBe(false);
      expect(v.action).toBe("block");
      expect(v.reasons.join(" ")).toContain("requires governance approval");
    }
  });

  it("high risk with governanceApproved passes behavior-level", () => {
    const v = behaviorLevelPolicy.check(
      makeMission({ workflowId: "wf-enterprise-rbac", risk: "high", governanceApproved: true })
    );
    expect(v.allowed).toBe(true);
  });

  it("workflow JSON files declare behaviorLevel matching the policy map", () => {
    for (const wf of ["wf-LEARN-EXEC", "wf-enterprise-rbac", "wf-evolution-dna-governance"] as const) {
      const raw = JSON.parse(readFileSync(join(WF_DIR, `${wf}.json`), "utf-8")) as {
        behaviorLevel?: number;
      };
      expect(raw.behaviorLevel).toEqual(governanceForWorkflow(wf).level);
    }
  });

  it("evaluateAll aggregates reasons in canonical order with the four policies", () => {
    const v = evaluateAll(makeMission({ workflowId: "wf-enterprise-rbac" }), [
      behaviorLevelPolicy,
      riskGovernancePolicy,
      protectedPathsPolicy,
      defaultPolicy,
    ]);
    expect(v.allowed).toBe(true);
    const ids = v.reasons.map((r) => r.slice(1, r.indexOf("]")));
    expect(ids).toEqual(["default", "protected-paths", "risk-governance", "behavior-level"]);
  });

  it("governanceForWorkflow returns defaults for truly unknown workflows", () => {
    expect(governanceForWorkflow("no-such-workflow")).toEqual({ risk: "medium", level: 2, requiresApproval: false });
  });

  it("defaultPolicy still blocks missions missing required fields", () => {
    expect(defaultPolicy.check(makeMission({ id: "" })).allowed).toBe(false);
    expect(defaultPolicy.check(makeMission({ title: "" })).allowed).toBe(false);
    expect(defaultPolicy.check(makeMission({ workflowId: "" })).allowed).toBe(false);
    expect(defaultPolicy.check(makeMission()).allowed).toBe(true);
  });

  it("protectedPathsPolicy blocks protected host paths in inputs", () => {
    expect(protectedPathsPolicy.check(makeMission({ inputs: { file: "prisma/migrations/001.sql" } })).allowed).toBe(false);
    expect(protectedPathsPolicy.check(makeMission({ inputs: { file: ".env" } })).allowed).toBe(false);
    expect(protectedPathsPolicy.check(makeMission({ inputs: { file: "node_modules/x" } })).allowed).toBe(false);
    expect(protectedPathsPolicy.check(makeMission({ inputs: { file: "src/index.ts" } })).allowed).toBe(true);
  });

  it("evolve/brainstorm/learn get their expected behavior levels", () => {
    expect(behaviorLevelPolicy.check(makeMission({ workflowId: "evolve" })).reasons.join(" ")).toContain("behavior level 7");
    expect(behaviorLevelPolicy.check(makeMission({ workflowId: "brainstorm" })).reasons.join(" ")).toContain("behavior level 4");
    expect(behaviorLevelPolicy.check(makeMission({ workflowId: "learn" })).reasons.join(" ")).toContain("behavior level 4");
  });
});
