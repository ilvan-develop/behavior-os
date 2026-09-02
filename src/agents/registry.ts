/** Agent Registry — maps stage → agent → skill.
 * Fonte única para orquestrador não hardcodar nomes.
 */
export interface AgentEntry {
  id: string;
  mode: "primary" | "subagent";
  description: string;
  skill: string;
  permission: Record<string, string>;
}

export const agentRegistry: Record<string, AgentEntry> = {
  orchestrator: { id: "orchestrator", mode: "primary", description: "Orchestrates workflows and delegates", skill: "evidence", permission: { "*": "allow" } },
  researcher:   { id: "researcher",   mode: "subagent", description: "Discovers repo facts", skill: "discover", permission: { edit: "deny" } },
  planner:      { id: "planner",      mode: "subagent", description: "Plans implementation", skill: "planning", permission: { edit: "deny" } },
  architect:    { id: "architect",    mode: "subagent", description: "Architects solution", skill: "architecture", permission: { edit: "deny" } },
  implementer:  { id: "implementer",  mode: "subagent", description: "Implements changes", skill: "implementation", permission: { edit: "allow" } },
  qa:           { id: "qa",           mode: "subagent", description: "Tests and verifies", skill: "verification", permission: { edit: "ask" } },
  security:     { id: "security",     mode: "subagent", description: "Security and governance gate", skill: "security", permission: { edit: "deny" } },
  reviewer:     { id: "reviewer",     mode: "subagent", description: "Reviews and approves", skill: "verification", permission: { edit: "deny" } },
};

export function getAgent(id: string): AgentEntry | undefined { return agentRegistry[id]; }
export function listAgents(): AgentEntry[] { return Object.values(agentRegistry); }
