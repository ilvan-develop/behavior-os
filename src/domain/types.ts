/** Domain types — behaviorOS v1.1.0
 * Cada tipo é único e documentado. Não repetir conteúdo de policies.ts
 */

export type BehaviorKind = "atomic" | "animal" | "celestial" | "military";

export interface Behavior {
  kind: BehaviorKind;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
}

export interface Mission {
  id: string;
  title: string;
  goal: string;
  workflowId: string;
  createdAt: string;
  inputs: Record<string, unknown>;
}

export interface WorkflowStage {
  id: string;
  agent: string;
  skill: string;
  gated: boolean;
}

export interface Workflow {
  id: string;
  version: string;
  stages: WorkflowStage[];
  handoffs: Record<string, string>;
  parallelGroups?: string[][]; // v1.4: groups of stage ids that run via Promise.all (orchestrator-workers)
  behaviorLevel?: number; // 0-7 governance level (from workflow JSON)
  autonomous?: { maxMissions: number; evaluatorRequired: boolean; chain: string[] };
}

export type EvidenceStatus = "COMPLETED" | "FAILED" | "IN_PROGRESS";

// ADR 005 — evidence.traces correlaciona mission → W3C traceId
export interface EvidenceTraces {
  traceId: string; // TraceId W3C 32 hex
  file: string; // behavior-os/runtime/traces/<mission>.json
  exists: boolean;
  spanCount: number;
  sampled: boolean;
  parentSpanId: string | null; // SpanId root
}

export interface Evidence {
  missionId: string;
  workflowId: string;
  status: EvidenceStatus;
  startedAt: string;
  finishedAt?: string;
  stages: Array<{ stage: string; status: EvidenceStatus; output?: string }>;
  governance: { policyId: string; verdict: "pass" | "fail"; reasons: string[] };
  graphify?: { graphPath: string; exists: boolean; nodeCount?: number; freshness?: string };
  langgraph?: { available: boolean; reason: string; compiled?: boolean; nodeCount?: number; threadId?: string };
  evaluator?: { approved: boolean; iterations: number; feedback: string[]; coverage: { stages: { total: number; completed: number; pct: number }; governance: string; graphify: string; langgraph: string; overall: number } };
  traces?: EvidenceTraces;
  version?: string; // ADR 006 — Semver do workflow no momento da missão (snapshot de getWorkflowVersion)
  controlPlane?: {
    workflowVersion: string;
    flags: Record<string, boolean>; // snapshot dos flags avaliados na missão
  };
  mcp?: {
    snapshotFile: string; // "behavior-os/runtime/mcp.json"
    exists: boolean;
    toolCount: number;
    serverCount: number;
    invocations: import("./mcp.js").GatewayInvocation[];
    valid: boolean;
  };
  federation?: {
    federatedPath: string; // "graphify-out/federated.json"
    exists: boolean;
    sources: import("./federation.js").GraphProvenance[];
    stats: import("./federation.js").MergeStats;
    valid: boolean;
    conflicts: number;
    generatedAt: string;
  };
  selfEvolution?: import("./self-evolution.js").SelfEvolutionEvidence;
}

export type GovernanceAction = "block" | "escalate" | "warn" | "log" | "pass";

export interface GovernanceVerdict {
  allowed: boolean;
  action: GovernanceAction;
  reasons: string[];
  policyId: string;
}
