/** Store — writes graphify-out/federated.json (ADR 009 Regra de Ouro)
 * Unique writer/reader for federated graph + snapshot. Keeps host sovereign (local graph is canonical).
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import type { FederatedGraph, FederatedSnapshot } from "../../src/domain/federation.js";

export function federatedPath(root = process.cwd()): string {
  return join(root, "graphify-out", "federated.json");
}

export function hashFile(path: string): string {
  try {
    const buf = readFileSync(path);
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return "";
  }
}

export function hashContent(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function readFederated(root = process.cwd()): { snapshot: FederatedSnapshot; graph: FederatedGraph } | null {
  const p = federatedPath(root);
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as any;
    // federated.json schema includes both snapshot fields at top level + nested graph
    // ADR schema: { version, generatedAt, graphPath, sources, stats, valid, errors, graph: { directed, ... } }
    if (!parsed.graph || !Array.isArray(parsed.graph.nodes)) {
      // maybe legacy: try top-level nodes?
      if (Array.isArray(parsed.nodes)) {
        const graph: FederatedGraph = {
          directed: parsed.directed ?? false,
          multigraph: parsed.multigraph ?? false,
          graph: parsed.graph ?? {},
          nodes: parsed.nodes,
          links: parsed.links ?? [],
        };
        const snapshot: FederatedSnapshot = {
          version: parsed.version ?? "0.0.0",
          generatedAt: parsed.generatedAt ?? new Date().toISOString(),
          sources: parsed.sources ?? [],
          stats: parsed.stats ?? { sources: parsed.sources ?? [], totalBeforeDedup: graph.nodes.length, totalAfterDedup: graph.nodes.length, deduped: 0, conflicts: 0, edgesMerged: graph.links.length, edgeConflicts: 0 },
          graphPath: parsed.graphPath ?? "graphify-out/federated.json",
          valid: parsed.valid ?? true,
          errors: parsed.errors ?? [],
        };
        return { snapshot, graph };
      }
      return null;
    }
    const graph: FederatedGraph = {
      directed: parsed.graph.directed ?? false,
      multigraph: parsed.graph.multigraph ?? false,
      graph: parsed.graph.graph ?? {},
      nodes: parsed.graph.nodes,
      links: parsed.graph.links ?? parsed.graph.edges ?? [],
    };
    // also support flat graph inside snapshot.graph
    const snapshot: FederatedSnapshot = {
      version: parsed.version,
      generatedAt: parsed.generatedAt,
      sources: parsed.sources,
      stats: parsed.stats,
      graphPath: parsed.graphPath ?? "graphify-out/federated.json",
      valid: parsed.valid,
      errors: parsed.errors ?? [],
    };
    return { snapshot, graph };
  } catch {
    return null;
  }
}

export function writeFederated(graph: FederatedGraph, snapshot: FederatedSnapshot, root = process.cwd()): string {
  // deterministic: sort nodes by id lexicographic before stringify
  const sortedNodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedLinks = [...graph.links].sort((a, b) => {
    const ka = `${a.source}->${a.target}`;
    const kb = `${b.source}->${b.target}`;
    return ka.localeCompare(kb);
  });
  const sortedGraph: FederatedGraph = {
    directed: graph.directed,
    multigraph: graph.multigraph,
    graph: graph.graph,
    nodes: sortedNodes,
    links: sortedLinks,
  };
  // snapshot also sorts sources by source for determinism? keep order as inserted (local first)
  const data = {
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    graphPath: snapshot.graphPath,
    sources: snapshot.sources,
    stats: snapshot.stats,
    valid: snapshot.valid,
    errors: snapshot.errors,
    graph: sortedGraph,
  };
  const p = federatedPath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
  return p;
}

export function ensureFederatedStat(path: string): { hash: string; mtime: string; freshness: "fresh" | "stale" | "missing"; nodeCount: number; edgeCount: number } {
  const fallback = { hash: "", mtime: new Date(0).toISOString(), freshness: "missing" as const, nodeCount: 0, edgeCount: 0 };
  if (!existsSync(path)) return fallback;
  try {
    const stat = statSync(path);
    const mtime = new Date(stat.mtimeMs).toISOString();
    const ageMs = Date.now() - stat.mtimeMs;
    const freshness = ageMs < 24 * 3600 * 1000 ? "fresh" as const : "stale" as const;
    const raw = readFileSync(path, "utf-8");
    const hashShort = createHash("sha256").update(raw).digest("hex").slice(0, 16);
    let nodeCount = 0;
    let edgeCount = 0;
    try {
      const data = JSON.parse(raw);
      nodeCount = Array.isArray(data.nodes) ? data.nodes.length : 0;
      edgeCount = Array.isArray(data.links) ? data.links.length : Array.isArray(data.edges) ? data.edges.length : 0;
    } catch {}
    return { hash: hashShort, mtime, freshness, nodeCount, edgeCount };
  } catch {
    return fallback;
  }
}
