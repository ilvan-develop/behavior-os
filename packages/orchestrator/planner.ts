/** Planner — v3.0 Universal Team Composition
 * Escolhe equipa dinâmica baseada em capabilities, não em workflow fixo.
 * Prova que Behavior OS pode orquestrar qualquer equipa (3-10 agents) sem mudar Kernel.
 */
export interface AgentCap {
  id: string;
  capabilities: string[]; // ex: ["discover","security","nextjs"]
  level: number; // behaviorLevel
}

const registry: AgentCap[] = [
  { id: "researcher", capabilities: ["discover", "research"], level: 2 },
  { id: "planner", capabilities: ["plan", "planning"], level: 2 },
  { id: "architect", capabilities: ["architecture", "design"], level: 2 },
  { id: "implementer", capabilities: ["implementation", "code"], level: 3 },
  { id: "qa", capabilities: ["verification", "test"], level: 3 },
  { id: "security", capabilities: ["security", "governance"], level: 5 },
  { id: "reviewer", capabilities: ["review", "verification"], level: 5 },
  { id: "orchestrator", capabilities: ["evidence", "orchestration"], level: 5 },
  // futuros (capabilities ainda não usadas, mas já planejáveis)
  { id: "mobile", capabilities: ["mobile", "react-native"], level: 3 },
  { id: "devops", capabilities: ["devops", "deploy", "infra"], level: 4 },
];

export function planTeam(objective: string, requiredCapabilities: string[] = []): string[] {
  const lower = objective.toLowerCase();
  // inferência simples por palavras-chave (v3.0 stub; v3.1 será LLM + graph)
  const inferred: string[] = [];
  if (lower.includes("checkout") || lower.includes("payment") || lower.includes("auth")) inferred.push("security");
  if (lower.includes("multi-tenant") || lower.includes("architecture")) inferred.push("architecture");
  if (lower.includes("research") || lower.includes("discover")) inferred.push("discover");
  if (lower.includes("test") || lower.includes("verify")) inferred.push("verification");
  const needed = [...new Set([...requiredCapabilities, ...inferred])];
  if (needed.length === 0) needed.push("discover", "implementation");
  // mapeia capability → agent
  const team: string[] = [];
  for (const cap of needed) {
    const agent = registry.find((a) => a.capabilities.includes(cap));
    if (agent && !team.includes(agent.id)) team.push(agent.id);
  }
  // sempre inclui orchestrator para evidência
  if (!team.includes("orchestrator")) team.push("orchestrator");
  return team;
}

export function listAgents(): AgentCap[] {
  return [...registry];
}
