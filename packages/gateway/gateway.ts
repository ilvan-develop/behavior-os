/**
 * Gateway canônico — regras de permissão por agente (fail-closed por papel).
 * O plugin .opencode/plugins/behaviorOS.ts embute estas mesmas regras (self-contained);
 * este módulo é a fonte de verdade usada por testes e execução via SDK.
 */
export type GateDecision = {
  allowed: boolean;
  reason: string;
  action: "block" | "pass";
  evidence: string;
};

const AGENT_RULES: Record<string, { deny: string[]; reason: string }> = {
  researcher: { deny: ["bash", "write", "edit"], reason: "researcher is read-only" },
  security: { deny: ["write"], reason: "security cannot write due to DNA invariant" },
};

export function canExecute(tool: any, agent: any, workflow: any): GateDecision {
  const evidence = `tool:${tool} agent:${agent} workflow:${workflow}`;
  const rule = AGENT_RULES[agent];
  if (rule && rule.deny.includes(tool)) {
    return { allowed: false, reason: rule.reason, action: "block", evidence };
  }
  return { allowed: true, reason: "allow " + tool + " for " + agent + " in " + workflow, action: "pass", evidence };
}
