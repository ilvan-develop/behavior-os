// src/domain/versioning.ts — Control Plane Versioning contracts (ADR 006) — v1.3.0 LEARN-06
// Contratos puros sem fs/env — implementações em packages/control-plane/*

export const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export type SemverBump = "patch" | "minor" | "major";

export interface WorkflowVersion {
  workflowId: string;
  version: string; // Semver válido
  bump: SemverBump | null; // último bump aplicado
  updatedAt: string; // ISO-8601
}

export interface Versioning {
  /** Lê version de workflows/<id>.json (fallback "0.0.0" se ausente/corrompido) */
  getWorkflowVersion(workflowId: string): string;
  /** Valida Semver (regex acima, sem leading zeros) */
  isValidSemver(version: string): boolean;
  /** Calcula próximo Semver sem mutar disco: bump("1.2.3","minor") → "1.3.0" */
  bumpVersion(current: string, type: SemverBump): string;
  /** Persiste bump em workflows/<id>.json + atualiza control-plane.json */
  bumpWorkflowVersion(workflowId: string, type: SemverBump): WorkflowVersion;
  /** Lista todas as versões observáveis */
  listVersions(): Record<string, string>; // { development: "2.1.0", ... }
}

export type FlagSource = "env" | "dna" | "default";

export interface FlagEvaluation {
  flag: string;
  enabled: boolean;
  source: FlagSource;
  rawEnv?: string; // process.env[FEATURE_FLAG] se existir
  dnaValue?: boolean; // valor em DNA se existir
}

export interface FeatureFlags {
  /** Fail-closed: default false se env e DNA ausentes */
  isEnabled(flag: string): boolean;
  /** Auditoria: de onde veio a decisão */
  evaluate(flag: string): FlagEvaluation;
  /** Lista flags conhecidas (env + dna) */
  listFlags(): Record<string, FlagEvaluation>;
}

export interface ControlPlaneState {
  version: string; // behavior-os version (package.json)
  updatedAt: string; // ISO-8601
  workflows: Record<string, string>; // { workflowId: semver }
  flags: Record<string, FlagEvaluation>; // snapshot dos flags avaliados
  lastBump: { workflowId: string; from: string; to: string; type: SemverBump; at: string } | null;
}
