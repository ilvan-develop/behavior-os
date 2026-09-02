/** Tool: graph.search — ADR 007 — zod args/output + defineTool */
import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineTool } from "../tool.js";

export const GraphSearchArgs = z.object({
  query: z.string().min(1).max(200).describe("search query — node id, label, or regex"),
  kind: z.enum(["node", "edge", "any"]).optional().default("any").describe("filter by kind"),
  limit: z.number().int().min(1).max(100).optional().default(10).describe("max results"),
  graphPath: z.string().optional().default("graphify-out/graph.json").describe("graph file path"),
});

export const GraphSearchOutput = z.object({
  query: z.string(),
  totalNodes: z.number(),
  results: z.array(z.object({
    id: z.string(),
    label: z.string().optional(),
    kind: z.string().optional(),
    score: z.number(),
  })),
  truncated: z.boolean(),
});

export const graphSearchTool = defineTool({
  name: "graph.search",
  description: "Search knowledge graph nodes/edges by query — regex match on id/label with relevance score",
  args: GraphSearchArgs,
  output: GraphSearchOutput,
  execute: async (args) => {
    const p = join(process.cwd(), args.graphPath ?? "graphify-out/graph.json");
    if (!existsSync(p)) {
      return { query: args.query, totalNodes: 0, results: [], truncated: false };
    }
    let data: any;
    try { data = JSON.parse(readFileSync(p, "utf-8")); } catch { return { query: args.query, totalNodes: 0, results: [], truncated: false }; }
    const nodes: any[] = Array.isArray(data.nodes) ? data.nodes : [];
    const links: any[] = Array.isArray(data.links) ? data.links : Array.isArray(data.edges) ? data.edges : [];
    const pool: any[] = args.kind === "node" ? nodes : args.kind === "edge" ? links : [...nodes, ...links];
    const q = args.query.toLowerCase();
    let re: RegExp | null = null;
    try { re = new RegExp(args.query, "i"); } catch { re = null; }
    const scored = pool.map((n) => {
      const id = String(n.id ?? n.source ?? "");
      const label = String(n.label ?? n.type ?? "");
      let score = 0;
      if (id.toLowerCase() === q) score = 100;
      else if (id.toLowerCase().includes(q)) score = 75;
      else if (label.toLowerCase().includes(q)) score = 50;
      else if (re && (re.test(id) || re.test(label))) score = 30;
      return { id, label: label || undefined, kind: n.kind ?? n.type ?? (nodes.includes(n) ? "node" : "edge"), score };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);

    const limit = args.limit ?? 10;
    const results = scored.slice(0, limit);
    return { query: args.query, totalNodes: nodes.length, results, truncated: scored.length > limit };
  },
});

export default graphSearchTool;
