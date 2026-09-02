/** DNA Schema — v2.1
 * System, Project, Agent, Workflow DNAs com invariantes.
 */
export type DnaKind = "system" | "project" | "agent" | "workflow";

export interface DnaBase {
  kind: DnaKind;
  version: string;
  identity?: string;
  principles?: string[];
  invariants?: string[];
  rules?: Record<string, unknown>;
}

export interface SystemDna extends DnaBase {
  kind: "system";
  identity: string; // "Behavior OS"
  principles: string[]; // evidence_driven, governed_execution, explicit_state, modularity, verification_before_completion
  invariants: string[]; // no_unverified_completion, every_mission_has_evidence, state_must_be_persistent
}

export interface ProjectDna extends DnaBase {
  kind: "project";
  project: { name: string; type: string; stack?: Record<string, string>; architecture?: Record<string, unknown> };
  rules?: { coverage_minimum?: number; require_security_review?: boolean; [k: string]: unknown };
}

export interface AgentDna extends DnaBase {
  kind: "agent";
  agent: string;
  behavior?: Record<string, string>; // risk_detected: investigate
}

export interface WorkflowDna extends DnaBase {
  kind: "workflow";
  workflow: string;
  behaviorLevel?: number; // 0-7 Reactive→Self-Optimizing
}

export type AnyDna = SystemDna | ProjectDna | AgentDna | WorkflowDna;
