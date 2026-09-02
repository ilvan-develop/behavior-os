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
}

export type GovernanceAction = "block" | "escalate" | "warn" | "log" | "pass";

export interface GovernanceVerdict {
  allowed: boolean;
  action: GovernanceAction;
  reasons: string[];
  policyId: string;
}
