/** MCP Marketplace — 10 tools (LEARN-07) — ideia #6 brainstorm */
export const mcpTools = [
  "mission.create", "mission.get", "mission.list",
  "evidence.get", "evidence.list",
  "graph.query", "graph.getNode",
  "governance.evaluate", "dna.select", "skill.list"
];

export function getMcpMarketplace() { return { tools: mcpTools, count: mcpTools.length, provider: "behavior-os-mcp" }; }
