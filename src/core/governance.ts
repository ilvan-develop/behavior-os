/** Governance — enforces policies before any mutation (behavior-os).
 * Ordem: default → protected-paths → risk-governance → behavior-level (AND fail-closed, ordem para aggregation).
 * Inspirado no brocolis 5-gates: risk→permission→state→contract→approval, fail-closed.
 */
import type { Mission, GovernanceVerdict } from "../domain/types.js";
import { defaultPolicy, protectedPathsPolicy, riskGovernancePolicy, behaviorLevelPolicy, evaluateAll } from "../domain/policies.js";

export function govern(mission: Mission): GovernanceVerdict {
  return evaluateAll(mission, [defaultPolicy, protectedPathsPolicy, riskGovernancePolicy, behaviorLevelPolicy]);
}

export function assertGoverned(mission: Mission): void {
  const v = govern(mission);
  if (!v.allowed) throw new Error(`[governance:${v.policyId}] denied: ${v.reasons.join("; ")}`);
}

export function governanceForWorkflow(workflowId: string): { risk: string; level: number; requiresApproval: boolean } {
  const map: Record<string, { risk: string; level: number; requiresApproval: boolean }> = {
    development: { risk: "medium", level: 5, requiresApproval: false },
    feature: { risk: "medium", level: 5, requiresApproval: false },
    bugfix: { risk: "low", level: 3, requiresApproval: false },
    refactor: { risk: "low", level: 3, requiresApproval: false },
    migration: { risk: "high", level: 5, requiresApproval: true },
    "security-audit": { risk: "high", level: 5, requiresApproval: true },
    incident: { risk: "high", level: 4, requiresApproval: true },
    release: { risk: "high", level: 6, requiresApproval: true },
    research: { risk: "low", level: 2, requiresApproval: false },
    architecture: { risk: "medium", level: 2, requiresApproval: false },
    parallel: { risk: "medium", level: 5, requiresApproval: false },
    autonomous: { risk: "high", level: 7, requiresApproval: false },
  };
  return map[workflowId] ?? { risk: "medium", level: 2, requiresApproval: false };
}
