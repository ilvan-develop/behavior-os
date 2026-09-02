/** Graphify Adapter — knowledge layer, not authority.
 * Integração só funcional com graphify-out/graph.json.
 */
import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface GraphifyStatus {
  configured: boolean; // mcp declarado em opencode.json
  functional: boolean; // graphify-out/graph.json existe
  graphPath: string;
  nodeCount?: number;
  freshness?: "fresh" | "stale" | "missing";
}

export function graphifyStatus(): GraphifyStatus {
  const graphPath = join(process.cwd(), "graphify-out", "graph.json");
  const exists = existsSync(graphPath);
  let configured = false;
  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), "opencode.json"), "utf-8"));
    configured = !!cfg.mcp?.graphify;
  } catch {}
  let freshness: GraphifyStatus["freshness"] = "missing";
  let nodeCount: number | undefined;
  if (exists) {
    const ageMs = Date.now() - statSync(graphPath).mtimeMs;
    freshness = ageMs < 24 * 3600 * 1000 ? "fresh" : "stale";
    try {
      const data = JSON.parse(readFileSync(graphPath, "utf-8"));
      nodeCount = Array.isArray(data.nodes) ? data.nodes.length : undefined;
    } catch {}
  }
  return { configured, functional: exists, graphPath, freshness, nodeCount };
}

export function graphifyQuery(question: string, budget = 2000): string | null {
  if (!existsSync(join(process.cwd(), "graphify-out", "graph.json"))) return null;
  // v1.2: knowledge layer delegates to MCP tool query_graph; local fallback via CLI
  return `graphify query "${question}" --budget ${budget} (use MCP query_graph or CLI)`;
}

export function graphifyMcpCommand(): string[] {
  return ["python", "-m", "graphify.serve", "graphify-out/graph.json"];
}
