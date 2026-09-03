/** Policies — governance rules unique to this file.
 * Tipos genéricos ficam em types.ts; aqui só política.
 */
import type { Mission, GovernanceVerdict } from "./types.js";

export interface Policy {
  id: string;
  description: string;
  check: (mission: Mission) => GovernanceVerdict;
}

export const defaultPolicy: Policy = {
  id: "default",
  description: "Base policy: mission must have id, title, workflowId",
  check(mission: Mission): GovernanceVerdict {
    const reasons: string[] = [];
    if (!mission.id) reasons.push("missing mission.id");
    if (!mission.title) reasons.push("missing mission.title");
    if (!mission.workflowId) reasons.push("missing mission.workflowId");
    return {
      allowed: reasons.length === 0,
      action: reasons.length === 0 ? "pass" : "block",
      reasons: reasons.length ? reasons : ["all checks pass"],
      policyId: "default",
    };
  },
};

export const protectedPathsPolicy: Policy = {
  id: "protected-paths",
  description: "Blocks missions that target protected host paths",
  check(mission: Mission): GovernanceVerdict {
    const input = JSON.stringify(mission.inputs ?? {});
    const blocked = ["prisma/migrations", ".env", "node_modules"];
    const hit = blocked.find((p) => input.includes(p));
    if (hit) return { allowed: false, action: "block", reasons: [`blocked path: ${hit}`], policyId: "protected-paths" };
    return { allowed: true, action: "pass", reasons: ["no protected path"], policyId: "protected-paths" };
  },
};

export const riskGovernancePolicy: Policy = {
  id: "risk-governance",
  description: "Governance por risco: high requer security review e workflow com security stage",
  check(mission: Mission): GovernanceVerdict {
    const risk = (mission as any).risk ?? (mission.inputs as any)?.risk;
    const wf = mission.workflowId;
    const highRiskWorkflows = ["security-audit", "incident", "release", "migration"];
    if (risk === "high" && !highRiskWorkflows.includes(wf) && !wf.includes("security")) {
      return { allowed: false, action: "block", reasons: [`high risk mission requires security-audit or incident workflow, got ${wf}`], policyId: "risk-governance" };
    }
    if (risk === "medium") return { allowed: true, action: "escalate", reasons: ["medium risk escalate to security review"], policyId: "risk-governance" };
    return { allowed: true, action: "pass", reasons: ["risk governance pass"], policyId: "risk-governance" };
  },
};

export const behaviorLevelPolicy: Policy = {
  id: "behavior-level",
  description: "Mentalidade Behavior: workflow deve ter behaviorLevel 0-7 compatível com risco (fail-closed para high risk sem approval)",
  check(mission: Mission): GovernanceVerdict {
    const levelMap: Record<string, number> = {
      research: 2, architecture: 2, bugfix: 3, feature: 5, development: 5, parallel: 5, autonomous: 7, migration: 5, "security-audit": 5, incident: 4, release: 6, refactor: 3,
      brainstorm: 4, evolve: 7, learn: 4, "wf-LEARN-EXEC": 4, "wf-enterprise-rbac": 5, "wf-evolution-dna-governance": 5,
    };
    const wf = mission.workflowId;
    const level = levelMap[wf];
    if (level === undefined) return { allowed: true, action: "pass", reasons: ["unknown workflow level - allow"], policyId: "behavior-level" };
    // Level 5+ exige governance, Level 7 exige autonomous — fail-closed para high risk sem approval
    if (level >= 5 && !(mission as any).governanceApproved && (mission as any).risk === "high") {
      return { allowed: false, action: "block", reasons: [`behavior level ${level} requires governance approval for high risk workflow ${wf}`], policyId: "behavior-level" };
    }
    return { allowed: true, action: "warn", reasons: [`behavior level ${level} for ${wf}`], policyId: "behavior-level" };
  },
};

export function evaluateAll(mission: Mission, policies: Policy[]): GovernanceVerdict {
  const allReasons: string[] = [];
  let allowed = true;
  let blockingPolicy = "default";
  let action: GovernanceVerdict["action"] = "pass";
  // governança behavior-os: default → protected-paths → risk → behavior-level (AND fail-closed, ordem para razões)
  const ordered = [...policies].sort((a, b) => {
    const order = ["default", "protected-paths", "risk-governance", "behavior-level"];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });
  for (const p of ordered) {
    const v = p.check(mission);
    allReasons.push(...v.reasons.map((r) => `[${p.id}] ${r}`));
    if (!v.allowed) {
      allowed = false;
      blockingPolicy = p.id;
      action = v.action;
    } else if (allowed && v.action === "escalate" && action === "pass") {
      action = "escalate";
    } else if (allowed && v.action === "warn" && action === "pass") {
      action = "warn";
    }
  }
  const lastId = ordered[ordered.length - 1]?.id ?? "default";
  if (!allowed) return { allowed, action, reasons: allReasons, policyId: blockingPolicy };
  return { allowed, action, reasons: allReasons, policyId: lastId };
}
