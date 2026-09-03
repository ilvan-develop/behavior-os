// packages/control-plane/store.ts — ControlPlaneState persistence (ADR 006)
// Único escritor/leitor de behavior-os/state/control-plane.json — evidência observável
import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { ControlPlaneState, SemverBump } from "../../src/domain/versioning.js";
import { SEMVER_RE } from "../../src/domain/versioning.js";

export function controlPlanePath(root = process.cwd()): string {
  return join(root, "behavior-os", "state", "control-plane.json");
}

export function readControlPlaneState(root = process.cwd()): ControlPlaneState | null {
  const p = controlPlanePath(root);
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as ControlPlaneState;
    // validação mínima: version deve ser semver
    if (!parsed.version || !SEMVER_RE.test(parsed.version)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeControlPlaneState(state: ControlPlaneState, root = process.cwd()): void {
  const p = controlPlanePath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(state, null, 2), "utf-8");
}

export function ensureControlPlaneState(root = process.cwd()): ControlPlaneState {
  const existing = readControlPlaneState(root);
  if (existing) return existing;
  // bootstrap inicial: lê workflows e gera state mínimo
  const workflows: Record<string, string> = {};
  const wfDir = join(root, "behavior-os", "workflows");
  if (existsSync(wfDir)) {
    for (const f of readdirSync(wfDir).filter((x) => x.endsWith(".json"))) {
      try {
        const j = JSON.parse(readFileSync(join(wfDir, f), "utf-8"));
        if (j.id && j.version && SEMVER_RE.test(j.version)) workflows[j.id] = j.version;
      } catch {}
    }
  }
  // versão do pacote
  let pkgVersion = "1.3.0";
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    if (pkg.version && SEMVER_RE.test(pkg.version)) pkgVersion = pkg.version;
  } catch {}
  const state: ControlPlaneState = {
    version: pkgVersion,
    updatedAt: new Date().toISOString(),
    workflows,
    flags: {},
    lastBump: null,
  };
  writeControlPlaneState(state, root);
  return state;
}

export function updateControlPlaneWorkflows(root = process.cwd()): ControlPlaneState {
  const state = ensureControlPlaneState(root);
  const wfDir = join(root, "behavior-os", "workflows");
  if (existsSync(wfDir)) {
    for (const f of readdirSync(wfDir).filter((x) => x.endsWith(".json"))) {
      try {
        const j = JSON.parse(readFileSync(join(wfDir, f), "utf-8"));
        if (j.id && j.version && SEMVER_RE.test(j.version)) state.workflows[j.id] = j.version;
      } catch {}
    }
  }
  state.updatedAt = new Date().toISOString();
  writeControlPlaneState(state, root);
  return state;
}

export function getLastBump(root = process.cwd()): ControlPlaneState["lastBump"] {
  const state = readControlPlaneState(root) ?? ensureControlPlaneState(root);
  return state.lastBump;
}

export function setLastBump(bump: NonNullable<ControlPlaneState["lastBump"]>, root = process.cwd()): ControlPlaneState {
  const state = ensureControlPlaneState(root);
  state.lastBump = bump;
  state.updatedAt = new Date().toISOString();
  writeControlPlaneState(state, root);
  return state;
}
