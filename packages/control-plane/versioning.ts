// Control Plane — versioning de workflows/*.json + feature flags (LEARN-06) — ADR 006 v1.3.0 FIX
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { SEMVER_RE } from "../../src/domain/versioning.js";
import type { SemverBump, WorkflowVersion, FlagEvaluation, FlagSource } from "../../src/domain/versioning.js";
import { getDnaFlag, getAllDnaFlags } from "./dna-flags.js";
import { writeControlPlaneState, readControlPlaneState, ensureControlPlaneState } from "./store.js";

export { SEMVER_RE } from "../../src/domain/versioning.js";

export function getWorkflowVersion(workflowId: string): string {
  const p = join(process.cwd(), "behavior-os", "workflows", `${workflowId}.json`);
  if (!existsSync(p)) return "0.0.0";
  try {
    const v = JSON.parse(readFileSync(p, "utf-8")).version;
    return typeof v === "string" && v.length ? v : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function isValidSemver(version: string): boolean {
  return SEMVER_RE.test(version);
}

export function bumpVersion(current: string, type: SemverBump): string {
  if (!isValidSemver(current)) throw new Error("Invalid Semver");
  // extrai apenas X.Y.Z base (ignora prerelease/build para cálculo)
  const m = current.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/);
  if (!m) throw new Error("Invalid Semver");
  let [, maj, min, pat] = m;
  let major = parseInt(maj, 10);
  let minor = parseInt(min, 10);
  let patch = parseInt(pat, 10);
  if (type === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

export function bumpWorkflowVersion(workflowId: string, type: SemverBump): WorkflowVersion {
  const p = join(process.cwd(), "behavior-os", "workflows", `${workflowId}.json`);
  if (!existsSync(p)) throw new Error(`Workflow not found: ${workflowId}`);
  const raw = JSON.parse(readFileSync(p, "utf-8"));
  const current = raw.version ?? "0.0.0";
  if (!isValidSemver(current)) throw new Error("Invalid Semver");
  const next = bumpVersion(current, type);
  raw.version = next;
  // preserva ordenação
  writeFileSync(p, JSON.stringify(raw, null, 2), "utf-8");
  const updatedAt = new Date().toISOString();
  // atualiza control-plane.json
  const state = ensureControlPlaneState();
  const prev = state.workflows[workflowId] ?? current;
  state.workflows[workflowId] = next;
  state.version = (() => {
    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
      return pkg.version ?? state.version;
    } catch {
      return state.version;
    }
  })();
  state.updatedAt = updatedAt;
  state.lastBump = { workflowId, from: prev, to: next, type, at: updatedAt };
  writeControlPlaneState(state);
  return { workflowId, version: next, bump: type, updatedAt };
}

export function listVersions(): Record<string, string> {
  const dir = join(process.cwd(), "behavior-os", "workflows");
  if (!existsSync(dir)) return {};
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    try {
      const j = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      if (j.id && typeof j.version === "string") out[j.id] = j.version;
    } catch {}
  }
  return out;
}

// FeatureFlags — fail-closed com DNA fallback (ADR 006 §2, §4)
export function isFeatureEnabled(flag: string): boolean {
  const envKey = `FEATURE_${flag.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal === "true") return true;
  if (envVal === "false") return false;
  // env diferente de "true"/"false" é ignorado (tratado como ausente)
  const dnaVal = getDnaFlag(flag);
  if (typeof dnaVal === "boolean") return dnaVal;
  return false; // default false — nunca true implícito (fail-closed)
}

export function evaluateFlag(flag: string): FlagEvaluation {
  const envKey = `FEATURE_${flag.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal === "true" || envVal === "false") {
    return { flag, enabled: envVal === "true", source: "env" as FlagSource, rawEnv: envVal, dnaValue: getDnaFlag(flag) };
  }
  const dnaVal = getDnaFlag(flag);
  if (typeof dnaVal === "boolean") {
    return { flag, enabled: dnaVal, source: "dna" as FlagSource, rawEnv: envVal, dnaValue: dnaVal };
  }
  return { flag, enabled: false, source: "default" as FlagSource, rawEnv: envVal, dnaValue: undefined };
}

export function listFlags(): Record<string, FlagEvaluation> {
  const out: Record<string, FlagEvaluation> = {};
  // coleta de DNA
  const dnaFlags = getAllDnaFlags();
  for (const k of Object.keys(dnaFlags)) {
    out[k] = evaluateFlag(k);
  }
  // coleta de env FEATURE_*
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("FEATURE_")) {
      const flag = k.slice("FEATURE_".length).toLowerCase();
      if (!(flag in out)) out[flag] = evaluateFlag(flag);
      else out[flag] = evaluateFlag(flag); // re-avalia com precedência env
    }
  }
  // garante canary sempre listado (mesmo sem env/dna)
  if (!("canary" in out)) out["canary"] = evaluateFlag("canary");
  return out;
}

// Adapter objects para injeção em src/core (opcional)
export const versioningAdapter = {
  getWorkflowVersion,
  isValidSemver,
  bumpVersion,
  bumpWorkflowVersion,
  listVersions,
};

export const featureFlagsAdapter = {
  isEnabled: isFeatureEnabled,
  evaluate: evaluateFlag,
  listFlags,
};
