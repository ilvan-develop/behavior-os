/** Self-Evolution contracts — behaviorOS v3.4 P2
 * Pure domain types — no fs/crypto/zod. Adapter lives in packages/self-evolution/*
 * TSON = Temporal Snapshot Object Notation — runtime/self-evolution.tson (JSON)
 * Regra de Ouro: self-evolution só é funcional com tsonPath observável + gateway + lastBump auditável
 */

import type { ControlPlaneState } from "./versioning.js";

export type TsonFreshness = "fresh" | "stale" | "missing";

export interface CoverageSnapshot {
  architecture: number;
  domain: number;
  dependencies: number;
  documentation: number;
  tests: number;
  governance: number;
  global: number;
  pass: boolean;
}

export interface SelfEvolutionDiscoverySnapshot {
  missionId: string;
  gaps: string[];
  proposals: Array<{
    kind: "new-skill" | "new-agent" | "new-workflow";
    reason: string;
    dnaPatch: Record<string, unknown>;
  }>;
  coverage: CoverageSnapshot;
}

export interface SelfEvolutionGatewaySnapshot {
  allowed: boolean;
  reason: string;
  action: "pass" | "block" | "warn" | "log" | "escalate";
  evidence: string;
}

export interface TsonSnapshot {
  /** ISO-8601 timestamp of tson generation */
  timestamp: string;
  /** behavior-os package version at generation time */
  version: string;
  discovery: SelfEvolutionDiscoverySnapshot;
  gateway: SelfEvolutionGatewaySnapshot;
  /** Graph staleness at generation — mirrors graphifyStatus freshness */
  graph?: {
    path: string; // "graphify-out/graph.json"
    exists: boolean;
    freshness: TsonFreshness;
    nodeCount?: number;
    hash?: string; // first 16 hex of graph.json
    mtime?: string; // ISO-8601
    staleReason?: string;
  };
  /** Federated snapshot pointer — mirrors evidence.federation.valid */
  federation?: {
    federatedPath: string; // "graphify-out/federated.json"
    exists: boolean;
    valid: boolean;
    conflicts?: number;
    generatedAt?: string;
  };
  /** Control-plane lastBump audit — mirrors control-plane.json lastBump */
  controlPlane?: {
    version: string;
    workflowVersion: string;
    flags: Record<string, boolean>;
    lastBump: ControlPlaneState["lastBump"];
  };
  /** Validation result — true iff discovery+gateway coherent and graph not stale when dna selfEvolution requires fresh */
  valid: boolean;
  errors: string[];
}

/** Evidence-selfEvolution — snapshot persistido em behavior-os/runtime/<mission>.json */
export interface SelfEvolutionEvidence {
  tsonPath: string; // "behavior-os/runtime/self-evolution.tson"
  exists: boolean;
  timestamp?: string;
  freshness: TsonFreshness;
  valid: boolean;
  gaps: string[];
  proposals: SelfEvolutionDiscoverySnapshot["proposals"];
  gateway: SelfEvolutionGatewaySnapshot;
  coverage?: CoverageSnapshot;
  lastBump: ControlPlaneState["lastBump"];
  generatedAt: string;
  errors: string[];
}

export interface SelfEvolution {
  /** Reads runtime/self-evolution.tson from disk if exists (adapter) */
  readTson(): TsonSnapshot | null;
  /** Validates snapshot + tson freshness + gateway */
  validate(snapshot: TsonSnapshot): { valid: boolean; errors: string[] };
  /** Serializable snapshot for evidence */
  snapshot(): TsonSnapshot;
  /** Writes runtime/self-evolution.tson (adapter) — sole writer via gateway allow */
  writeTson(snapshot: TsonSnapshot): void;
  /** In-memory discovery without I/O — delegates to orchestrator stub */
  discover(missionId: string): SelfEvolutionDiscoverySnapshot;
  /** Gateway check — can write tson? mirrors packages/gateway/gateway.ts canExecute */
  canEvolve(tool: string, agent: string, workflowId: string): { allowed: boolean; reason: string; action: string; evidence: string };
}
