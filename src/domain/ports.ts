/** Sdk Ports — behaviorOS v1.3.0 ADR 008 — contratos puros sem fs/process/zod */
import type { Mission, Workflow, Evidence } from "./types.js";
export type { Mission, Workflow, Evidence };

// Port raiz — única injeção que o SDK precisa
export interface SdkPorts {
  mission: MissionPort;
  workflow: WorkflowPort;
  evidence: EvidencePort;
  learning: LearningPort;
  governance: GovernancePort;
  kernel: KernelPort;
}

// Cada port é interface pura (hexagonal / ports & adapters)
export interface MissionPort {
  load(path: string): Mission;
  validate(mission: Mission): { allowed: boolean; policyId: string; reasons: string[] };
  execute(missionPath: string, workflowPath: string): Promise<Evidence>;
}

export interface WorkflowPort {
  load(path: string): Workflow;
  run(workflow: Workflow, mission: Mission): Promise<Evidence>;
  list(): Workflow[];
}

export interface EvidencePort {
  path(missionId: string): string;
  read(missionId: string): Evidence | null;
  write(evidence: Evidence): void;
  ledger(mission: Mission, workflow: Workflow): EvidenceLedgerPort;
}

export interface EvidenceLedgerPort {
  start(): Evidence;
  complete(extra?: Partial<Evidence>): Evidence;
  fail(reason: string): Evidence;
  readonly path: string;
}

export interface LearningPort {
  record(entry: LearningEntry): Promise<void>;
  detectPatterns(missionId: string): Promise<LearningPattern[]>;
}

export interface LearningEntry {
  missionId: string;
  signal: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface LearningPattern {
  id: string;
  signal: string;
  count: number;
}

export interface GovernancePort {
  check(mission: Mission): { allowed: boolean; action: "block" | "pass" | "warn"; policyId: string; reasons: string[] };
}

export interface KernelPort {
  emit(event: KernelEvent): void;
  getEvents(missionId: string): KernelEvent[];
  clearEvents(missionId?: string): void;
}

export interface KernelEvent {
  type: string;
  missionId: string;
  timestamp: string;
  [k: string]: unknown;
}

// Factory signature — implementação em src/index.ts
export declare function createSdkPorts(overrides?: Partial<SdkPorts>): SdkPorts;
