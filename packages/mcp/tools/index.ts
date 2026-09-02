/** MCP tools index — ADR 007 — aggregates 34 tools in packages/mcp/tools/*.ts
 * Provider: behavior-os-mcp — total 45 tools (10 legacy + 34 new + behaviorOS)
 */
import type { McpMarketplace } from "../../../src/domain/mcp.js";
import { missionUpdateTool } from "./mission-update.js";
import { evidenceValidateTool } from "./evidence-validate.js";
import { graphSearchTool } from "./graph-search.js";
import { governancePolicyCheckTool } from "./governance-policy-check.js";
import { dnaValidateTool } from "./dna-validate.js";

// Re-export detailed tools
export { missionUpdateTool, evidenceValidateTool, graphSearchTool, governancePolicyCheckTool, dnaValidateTool };

// Catalog of 34 new tools (dot names) — 5 implemented above, 29 stub-backed via marketplace loadFromDisk
export const newToolNames = [
  "mission.update", "mission.delete", "mission.complete", "mission.cancel",
  "evidence.validate", "evidence.snapshot", "evidence.export",
  "graph.search", "graph.ingest", "graph.listNodes", "graph.getEdges",
  "knowledge.retrieve", "knowledge.federate",
  "governance.policyCheck", "governance.policyList", "governance.audit",
  "dna.validate", "dna.resolve", "dna.evolution", "dna.list",
  "skill.get", "skill.invoke",
  "workflow.generate", "workflow.validate", "workflow.execute",
  "marketplace.snapshot", "marketplace.validate",
  "observability.trace", "observability.metrics",
  "control.status", "control.doctor",
  "gateway.invoke", "sdk.init", "store.write",
] as const;

export const legacyToolNames = [
  "mission.create", "mission.get", "mission.list",
  "evidence.get", "evidence.list",
  "graph.query", "graph.getNode",
  "governance.evaluate", "dna.select", "skill.list",
] as const;

export const allToolNames = [...legacyToolNames, ...newToolNames, "behaviorOS"] as const;

export const detailedTools = [
  missionUpdateTool,
  evidenceValidateTool,
  graphSearchTool,
  governancePolicyCheckTool,
  dnaValidateTool,
];

/** Register detailed tools into marketplace (idempotent) */
export function registerDetailedTools(marketplace: McpMarketplace): { registered: number; errors: string[] } {
  let registered = 0;
  const errors: string[] = [];
  for (const t of detailedTools) {
    if (marketplace.get(t.name)) continue;
    try {
      marketplace.register(t as any, { source: "builtin", file: `packages/mcp/tools/${t.name.replace(/\./g, "-")}.ts` });
      registered++;
    } catch (e) {
      errors.push(`register ${t.name}: ${String(e)}`);
    }
  }
  return { registered, errors };
}

export function catalog() {
  return {
    total: allToolNames.length,
    legacy: legacyToolNames.length,
    newDetailed: detailedTools.length,
    newTotal: newToolNames.length,
    provider: "behavior-os-mcp",
    tools: allToolNames,
  };
}
