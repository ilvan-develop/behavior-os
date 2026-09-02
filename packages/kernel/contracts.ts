export interface StageContract {
  id: string;
  input: string[];
  actor: string;
  capabilities: string[];
  constraints: string[];
  output: string[];
  acceptance: string[];
  evidence: string[];
  next: string;
  failure: string;
}

export function validateStage(contract: StageContract): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!contract.id) errors.push("missing id");
  if (!contract.actor) errors.push("missing actor");
  if (!contract.output.length) errors.push("missing output");
  if (!contract.evidence.length) errors.push("missing evidence");
  return { valid: errors.length === 0, errors };
}

export const developmentContracts: StageContract[] = [
  { id: "discover", input: ["mission"], actor: "researcher", capabilities: ["read", "graph"], constraints: ["readonly"], output: ["findings"], acceptance: ["findings not empty"], evidence: ["findings.md"], next: "plan", failure: "blocked" },
  { id: "plan", input: ["findings"], actor: "planner", capabilities: ["planning"], constraints: [], output: ["plan"], acceptance: ["plan approved"], evidence: ["plan.md"], next: "architect", failure: "re-plan" },
  { id: "implement", input: ["plan"], actor: "implementer", capabilities: ["edit"], constraints: ["host_sovereignty"], output: ["diff"], acceptance: ["typecheck pass"], evidence: ["diff"], next: "test", failure: "blocked" },
];
