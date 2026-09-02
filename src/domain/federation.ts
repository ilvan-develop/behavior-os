/** Federation contracts — behaviorOS v1.3.0 ADR 009
 * Pure domain types — no fs/crypto/zod. Adapter lives in packages/knowledge/federation.ts
 */

export type SourceId = "local" | "global" | string; // string allows workspace::project

export interface GraphProvenance {
  source: SourceId;
  path: string;               // relative normalized path, e.g. "graphify-out/graph.json"
  hash: string;               // sha256 first 16 hex of source file at merge time
  mtime: string;              // ISO-8601 of stat.mtime
  freshness: "fresh" | "stale" | "missing";
  nodeCount: number;          // nodes.length before merge
  edgeCount: number;          // links.length before merge
}

export interface NodeProvenance {
  id: string;
  source: SourceId;           // winning source after merge
  sources: SourceId[];        // all sources containing this id (dedup detection)
  source_file?: string;       // preserved from graphify-out/graph.json nodes[].source_file
  source_location?: string;   // L* preserved
  hash: string;               // stable hash of canonical winning node (first 16 hex)
}

export interface EdgeProvenance {
  source: string;
  target: string;
  provenance: SourceId;
}

export interface FederatedGraph {
  directed: boolean;
  multigraph: boolean;
  graph: Record<string, unknown>;
  nodes: Array<Record<string, unknown> & { id: string; provenance: NodeProvenance }>;
  links: Array<Record<string, unknown> & { source: string; target: string; provenance: SourceId }>;
}

export interface MergeStats {
  sources: GraphProvenance[]; // 1..N sources read (local mandatory, global optional)
  totalBeforeDedup: number;   // sum nodes of all sources
  totalAfterDedup: number;    // nodes.length federated
  deduped: number;            // totalBeforeDedup - totalAfterDedup
  conflicts: number;          // ids with same id but different hash
  edgesMerged: number;
  edgeConflicts: number;
}

export interface FederatedSnapshot {
  version: string;            // semver of behavior-os at federation time
  generatedAt: string;        // ISO-8601
  sources: GraphProvenance[];
  stats: MergeStats;
  graphPath: string;          // "graphify-out/federated.json"
  valid: boolean;             // result of Federation.validate()
  errors: string[];
}

export interface Federation {
  /** Reads sources (local mandatory) and returns in-memory federated graph (no disk write) */
  federate(opts?: { localPath?: string; globalPaths?: string[] }): Promise<FederatedGraph>;
  /** Pure deterministic merge — used in tests, no I/O */
  merge(graphs: Array<{ source: SourceId; graph: FederatedGraph | { nodes: any[]; links: any[] } }>): FederatedGraph;
  /** Validates snapshot + federated.json */
  validate(snapshot: FederatedSnapshot, graph: FederatedGraph): { valid: boolean; errors: string[] };
  /** Serializable snapshot for federated.json + evidence */
  snapshot(): FederatedSnapshot;
  /** Reads federated.json from disk if exists (adapter) */
  readFederated(): FederatedGraph | null;
  /** Writes federated.json (adapter) — sole writer */
  writeFederated(graph: FederatedGraph, snapshot: FederatedSnapshot): void;
}
