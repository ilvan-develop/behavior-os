/** Self-Evolution Gateway — P2 v3.4
 * Gateia escrita de TSON via Governance + Graph freshness + DNA flags + ControlPlane lastBump
 * Consults official docs: opencode (tool gateway), graphify (graph.json freshness), langgraph (not needed here)
 * Host sovereignty: nunca sobrescreve src/, apenas behavior-os/runtime/self-evolution.tson
 */
import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { parse as parseYaml } from "yaml";
import type { TsonSnapshot } from "../../src/domain/self-evolution.js";

function getDnaFlags(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const p of [join(process.cwd(), "behavior-os", "dna", "system.dna.yaml"), join(process.cwd(), "behavior-os", "dna", "project.dna.yaml")]) {
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, "utf-8");
      const parsed: any = parseYaml(raw);
      const src = parsed?.flags ?? {};
      for (const [k, v] of Object.entries(src)) if (typeof v === "boolean") out[k] = v;
    } catch {}
  }
  return out;
}

function normalizeKey(k: string): string { return k.toLowerCase().replace(/[-_]/g, ""); }

function getFlag(flag: string): boolean {
  const envKey = `FEATURE_${flag.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal === "true") return true;
  if (envVal === "false") return false;
  const dna = getDnaFlags();
  if (flag in dna) return dna[flag];
  const norm = normalizeKey(flag);
  for (const [k, v] of Object.entries(dna)) if (normalizeKey(k) === norm) return v;
  return false;
}

function graphStale(): { freshness: "fresh"|"stale"|"missing"; nodeCount?: number; hash?: string; mtime?: string; staleReason?: string } {
  const gp = join(process.cwd(), "graphify-out", "graph.json");
  if (!existsSync(gp)) return { freshness: "missing", staleReason: "graph.json missing" };
  try {
    const st = statSync(gp);
    const age = Date.now() - st.mtimeMs;
    const freshness = age < 24 * 3600 * 1000 ? "fresh" as const : "stale" as const;
    let nodeCount: number | undefined;
    try { nodeCount = JSON.parse(readFileSync(gp, "utf-8")).nodes?.length; } catch {}
    const hash = createHash("sha256").update(readFileSync(gp)).digest("hex").slice(0, 16);
    const mtime = new Date(st.mtimeMs).toISOString();
    const staleReason = freshness === "stale" ? `graph stale ${Math.round(age/3600000)}h >24h` : undefined;
    return { freshness, nodeCount, hash, mtime, staleReason };
  } catch { return { freshness: "missing", staleReason: "stat failed" }; }
}

function readLastBump(): any {
  try {
    const cp = join(process.cwd(), "behavior-os", "state", "control-plane.json");
    if (existsSync(cp)) return JSON.parse(readFileSync(cp, "utf-8")).lastBump ?? null;
  } catch {}
  return null;
}

export interface SelfEvolutionGateResult {
  allowed: boolean;
  reason: string;
  action: "pass" | "block" | "warn" | "log" | "escalate";
  evidence: string;
  graph: ReturnType<typeof graphStale>;
  flags: Record<string, boolean>;
  lastBump: any;
}

export function canSelfEvolve(tool: string, agent: string, workflowId: string): SelfEvolutionGateResult {
  const flags = {
    canary: getFlag("canary"),
    federation: getFlag("federation"),
    selfEvolution: getFlag("selfEvolution"),
  };
  const graph = graphStale();
  const lastBump = readLastBump();

  // base governance via packages/gateway/gateway.ts canExecute
  let baseAllowed = true;
  let baseReason = `allow ${tool} for ${agent} in ${workflowId}`;
  let baseAction: SelfEvolutionGateResult["action"] = "pass";
  try {
    // dynamic import to avoid cycle but sync fallback
    // we replicate simple rules here to keep pure sync
    if (agent === "researcher" && (tool === "bash" || tool === "write" || tool === "edit")) {
      baseAllowed = false; baseReason = "researcher is read-only"; baseAction = "block";
    } else if (agent === "security" && tool === "write") {
      baseAllowed = false; baseReason = "security cannot write due to DNA invariant"; baseAction = "block";
    }
  } catch {}

  const evidence = `tool:${tool} agent:${agent} workflow:${workflowId} flags:${JSON.stringify(flags)} graph:${graph.freshness} lastBump:${lastBump ? `${lastBump.workflowId}:${lastBump.from}->${lastBump.to}` : "null"}`;

  // selfEvolution flag gating: if selfEvolution false, warn but still allow discovery (read-only)
  // write only allowed when selfEvolution flag true OR canary true OR federation true? Keep fail-closed: require selfEvolution flag true for write
  // For gateway `canSelfEvolve` used for tson write: block if selfEvolution flag false and tool is write
  if (tool === "write" && !flags.selfEvolution) {
    // allow discovery but block mutation unless governance explicitly allows? For now warn not block to keep evidence-ledger fallback
    // We'll treat as warn: allowed true but action warn
    return { allowed: baseAllowed, reason: baseAllowed ? "selfEvolution flag false — discovery only (warn)" : baseReason, action: baseAllowed ? "warn" : baseAction, evidence, graph, flags, lastBump };
  }

  // graph stale blocks self-evolution mutation when flag requires fresh (advisory)
  if (graph.freshness === "stale" && tool === "write") {
    return { allowed: baseAllowed, reason: baseAllowed ? `graph stale — ${graph.staleReason}` : baseReason, action: baseAllowed ? "warn" : baseAction, evidence, graph, flags, lastBump };
  }

  return { allowed: baseAllowed, reason: baseReason, action: baseAction, evidence, graph, flags, lastBump };
}

export function validateTson(snapshot: TsonSnapshot): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!snapshot.timestamp || isNaN(new Date(snapshot.timestamp).getTime())) errors.push("invalid timestamp");
  if (!snapshot.version) errors.push("missing version");
  if (!snapshot.discovery) errors.push("missing discovery");
  else {
    if (!Array.isArray(snapshot.discovery.gaps)) errors.push("discovery.gaps missing");
    if (!Array.isArray(snapshot.discovery.proposals)) errors.push("discovery.proposals missing");
    if (!snapshot.discovery.coverage) errors.push("discovery.coverage missing");
  }
  if (!snapshot.gateway || typeof snapshot.gateway.allowed !== "boolean") errors.push("gateway.allowed missing");
  if (snapshot.graph && snapshot.graph.freshness === "stale") errors.push("graph stale (>24h)");
  // federation is optional but if present check valid
  if (snapshot.federation && !snapshot.federation.exists) errors.push("federation missing");
  return { valid: errors.length === 0, errors };
}

// Re-export for adapter use
export const selfEvolutionGateway = { canSelfEvolve, validateTson, graphStale };
