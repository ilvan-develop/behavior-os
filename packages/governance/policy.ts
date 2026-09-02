/**
 * Governance Policy Adapter — ADR-004 Policy as Code
 * Avalia packages/governance/policy.rego via OPA WASM (opa eval) com fallback TS src/domain/policies.ts
 * Gera behavior-os/runtime/audit.log hash chain sha256(prev+entry) — fail-closed
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import type { Mission, GovernanceVerdict, GovernanceAction } from "../../src/domain/types.js";
import {
  defaultPolicy,
  protectedPathsPolicy,
  riskGovernancePolicy,
  behaviorLevelPolicy,
  evaluateAll,
} from "../../src/domain/policies.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
export const REGO_PATH = join(process.cwd(), "packages", "governance", "policy.rego");
export const AUDIT_LOG_PATH = join(process.cwd(), "behavior-os", "runtime", "audit.log");
export const POLICY_ID = "behavioros.governance";
export const GENESIS_HASH = "0".repeat(64);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RegoInput {
  risk?: string;
  workflowId?: string;
  missionId?: string;
  inputs?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface OpaResult {
  allow: boolean;
  deny: string[];
  action: GovernanceAction;
}

export interface AuditRecord {
  timestamp: string;
  missionId: string;
  workflowId: string;
  risk: string;
  allowed: boolean;
  action: GovernanceAction;
  policyId: string;
  reasons: string[];
  prevHash: string;
  hash: string;
  source: string;
  regoPath: string;
}

// ---------------------------------------------------------------------------
// Pure JS mirror of policy.rego (deterministic, usado quando OPA binário ausente)
// ---------------------------------------------------------------------------
export function evaluateRegoJS(input: RegoInput): OpaResult {
  const risk = (input.risk ?? (input.inputs as unknown as Record<string, unknown>)?.risk ?? "unknown") as string;
  const workflowId = (input.workflowId ?? (input as unknown as { workflowId?: string }).workflowId ?? "") as string;

  // policy.rego:
  // allow if input.risk != "high"
  // allow if risk==high && workflowId == security-audit
  // allow if risk==high && workflowId == incident
  // deny contains msg if risk==high && not allow
  if (risk !== "high") {
    const action: GovernanceAction = risk === "medium" ? "escalate" : risk === "low" ? "warn" : "pass";
    return { allow: true, deny: [], action };
  }
  if (workflowId === "security-audit" || workflowId === "incident") {
    return { allow: true, deny: [], action: "pass" };
  }
  const msg = `high risk mission requires security-audit or incident workflow, got ${workflowId}`;
  return { allow: false, deny: [msg], action: "block" };
}

// ---------------------------------------------------------------------------
// OPA WASM / CLI attempt (tenta opa evaluate, fallback null)
// ---------------------------------------------------------------------------
export async function tryOpaWasm(input: RegoInput): Promise<OpaResult | null> {
  // 1) Tenta WASM compilado packages/governance/policy.wasm via @opa/wasm (se disponível)
  const wasmPath = join(process.cwd(), "packages", "governance", "policy.wasm");
  if (existsSync(wasmPath)) {
    try {
      // dynamic import opcional — se não instalado, ignora
      const opaWasm = await import("@opa/wasm" as string).catch(() => null as unknown);
      if (opaWasm) {
        const wasmBuf = readFileSync(wasmPath);
        // @ts-ignore
        const policy = await (opaWasm as unknown as { loadPolicy: (b: Uint8Array) => Promise<{ evaluate: (i: unknown) => { result: unknown } }> }).loadPolicy(wasmBuf);
        const res = policy.evaluate(input) as unknown as { result?: { allow?: boolean; deny?: string[] } };
        if (res?.result) {
          const allow = Boolean((res.result as { allow?: boolean }).allow);
          const deny = ((res.result as { deny?: string[] }).deny as string[]) ?? [];
          return { allow, deny, action: allow ? "pass" : "block" };
        }
      }
    } catch {
      // fallback para CLI
    }
  }

  // 2) Tenta OPA CLI: opa eval -d policy.rego -i input.json "data.behavioros.governance"
  try {
    execSync("opa version", { stdio: "ignore" });
    if (!existsSync(REGO_PATH)) return null;
    const tmpInput = join(process.cwd(), "behavior-os", "runtime", ".opa-input.json");
    mkdirSync(dirname(tmpInput), { recursive: true });
    const { writeFileSync, unlinkSync } = await import("node:fs");
    writeFileSync(tmpInput, JSON.stringify(input), "utf-8");
    try {
      const out = execSync(
        `opa eval --format=json --data "${REGO_PATH}" --input "${tmpInput}" "data.behavioros.governance.allow"`,
        { encoding: "utf-8" }
      );
      const parsed = JSON.parse(out);
      const allow = Boolean(parsed?.result?.[0]?.expressions?.[0]?.value);
      // tenta também deny
      let deny: string[] = [];
      try {
        const outDeny = execSync(
          `opa eval --format=json --data "${REGO_PATH}" --input "${tmpInput}" "data.behavioros.governance.deny"`,
          { encoding: "utf-8" }
        );
        const p2 = JSON.parse(outDeny);
        const v = p2?.result?.[0]?.expressions?.[0]?.value;
        if (Array.isArray(v)) deny = v as string[];
      } catch {
        // deny opcional
      }
      try { unlinkSync(tmpInput); } catch {}
      return { allow, deny, action: allow ? "pass" : "block" };
    } catch {
      try { unlinkSync(tmpInput); } catch {}
      return null;
    }
  } catch {
    // opa não instalado
    return null;
  }
}

/**
 * Sync variant — usa evaluateRegoJS (sem spawn). Mantém compatibilidade para govern() sync.
 */
export function tryOpaSync(input: RegoInput): OpaResult | null {
  // Sem WASM sync confiável, usa JS mirror quando OPA CLI não disponível
  // Retorna null para indicar fallback TS deve ser usado? Mas para manter determinismo,
  // retornamos evaluateRegoJS como resultado OPA simulado quando rego existe.
  if (!existsSync(REGO_PATH)) return null;
  return evaluateRegoJS(input);
}

// ---------------------------------------------------------------------------
// Hash chain — behavior-os/runtime/audit.log append-only sha256(prev+entry)
// ---------------------------------------------------------------------------
export function computeHash(prevHash: string, entryWithoutHashJson: string): string {
  return createHash("sha256").update(prevHash + entryWithoutHashJson).digest("hex");
}

export function readAuditLog(): AuditRecord[] {
  if (!existsSync(AUDIT_LOG_PATH)) return [];
  const raw = readFileSync(AUDIT_LOG_PATH, "utf-8").trim();
  if (!raw) return [];
  return raw
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try { return JSON.parse(l) as AuditRecord; } catch { return null as unknown as AuditRecord; }
    })
    .filter(Boolean);
}

export function verifyAuditLog(): { valid: boolean; reason?: string; count: number } {
  const records = readAuditLog();
  if (records.length === 0) return { valid: true, count: 0 };
  let prev = GENESIS_HASH;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.prevHash !== prev) {
      return { valid: false, reason: `hash chain broken at index ${i}: expected prevHash ${prev}, got ${r.prevHash}`, count: records.length };
    }
    const { hash, ...withoutHash } = r as AuditRecord & { hash: string };
    const recomputed = computeHash(prev, JSON.stringify(withoutHash));
    if (recomputed !== hash) {
      return { valid: false, reason: `hash mismatch at index ${i}: expected ${recomputed}, got ${hash}`, count: records.length };
    }
    prev = hash;
  }
  return { valid: true, count: records.length };
}

export function appendAuditLog(params: {
  missionId: string;
  workflowId: string;
  risk?: string;
  verdict: GovernanceVerdict;
  source: string;
}): AuditRecord {
  mkdirSync(dirname(AUDIT_LOG_PATH), { recursive: true });
  let prevHash = GENESIS_HASH;
  if (existsSync(AUDIT_LOG_PATH)) {
    const existing = readAuditLog();
    if (existing.length > 0) prevHash = existing[existing.length - 1].hash;
  }

  const base = {
    timestamp: new Date().toISOString(),
    missionId: params.missionId,
    workflowId: params.workflowId,
    risk: params.risk ?? "unknown",
    allowed: params.verdict.allowed,
    action: params.verdict.action,
    policyId: params.verdict.policyId,
    reasons: params.verdict.reasons,
    prevHash,
    source: params.source,
    regoPath: REGO_PATH,
  };

  const hash = computeHash(prevHash, JSON.stringify(base));
  const record: AuditRecord = { ...base, hash };
  appendFileSync(AUDIT_LOG_PATH, JSON.stringify(record) + "\n", "utf-8");
  return record;
}

// ---------------------------------------------------------------------------
// Adapter — GovernancePolicy { id, regoPath, evaluate(input): Promise<Verdict> }
// ---------------------------------------------------------------------------
function toMission(input: RegoInput | Mission): Mission {
  // Se já é Mission (tem id/title/goal/workflowId), retorna direto
  if (typeof (input as Mission).id === "string" && typeof (input as Mission).workflowId === "string" && typeof (input as Mission).title === "string") {
    return input as Mission;
  }
  const r = input as RegoInput;
  const risk = (r.risk ?? (r.inputs as Record<string, unknown>)?.risk) as string | undefined;
  return {
    id: (r.missionId as string) ?? (r.id as string) ?? "unknown",
    title: (r.title as string) ?? `mission ${r.missionId ?? r.id ?? "unknown"}`,
    goal: (r.goal as string) ?? "",
    workflowId: (r.workflowId as string) ?? "development",
    createdAt: new Date().toISOString(),
    inputs: { ...(r.inputs as Record<string, unknown> ?? {}), ...(risk ? { risk } : {}) },
    // preserva governanceApproved/risk para behavior-level
    ...(risk ? { risk } : {}),
    ...((r as unknown as Record<string, unknown>).governanceApproved !== undefined ? { governanceApproved: (r as unknown as Record<string, unknown>).governanceApproved } : {}),
  } as unknown as Mission;
}

function normalizeRisk(mission: Mission): string {
  return ((mission as unknown as Record<string, unknown>).risk as string) ?? ((mission.inputs as Record<string, unknown>)?.risk as string) ?? "unknown";
}

export class GovernancePolicy {
  id = POLICY_ID;
  regoPath = REGO_PATH;

  /**
   * Avalia input via OPA WASM (opa evaluate) com fallback TS evaluateAll — fail-closed (AND).
   * Também registra audit.log hash chain.
   */
  async evaluate(input: RegoInput | Mission): Promise<GovernanceVerdict> {
    const mission = toMission(input);
    const risk = normalizeRisk(mission);

    // TS verdict (4 policies AND fail-closed)
    const tsVerdict = evaluateAll(mission, [defaultPolicy, protectedPathsPolicy, riskGovernancePolicy, behaviorLevelPolicy]);

    // Tenta OPA
    let opaResult: OpaResult | null = null;
    try {
      opaResult = await tryOpaWasm({
        risk,
        workflowId: mission.workflowId,
        missionId: mission.id,
        inputs: mission.inputs,
      });
    } catch {
      opaResult = null;
    }

    // Se OPA ausente, usa JS mirror quando rego existe para observabilidade, mas decisão final é TS fail-closed
    if (opaResult === null && existsSync(REGO_PATH)) {
      // usa JS mirror como "opa" para audit source, mas não altera decisão TS fail-closed
      const js = evaluateRegoJS({ risk, workflowId: mission.workflowId, missionId: mission.id, inputs: mission.inputs });
      // se JS deny e TS allow, ainda deve bloquear? Rego é autoridade para high risk.
      // fail-closed: ambos devem permitir. Então se JS bloqueia, final deve bloquear.
      if (!js.allow) {
        const merged: GovernanceVerdict = {
          allowed: false,
          action: "block",
          reasons: [...js.deny, ...tsVerdict.reasons],
          policyId: "policy.rego",
        };
        // Se TS também bloqueia, mantém block; se TS permite, ainda bloqueia por rego
        // Mas se TS bloqueia por outro motivo, prioriza rego+TS
        if (!tsVerdict.allowed) {
          merged.reasons = [...js.deny, ...tsVerdict.reasons];
          merged.policyId = tsVerdict.policyId.includes("policy.rego") ? "policy.rego" : tsVerdict.policyId;
        }
        appendAuditLog({ missionId: mission.id, workflowId: mission.workflowId, risk, verdict: merged, source: "rego-js+ts-fail-closed" });
        return merged;
      }
      // JS allow — decisão é TS
      appendAuditLog({ missionId: mission.id, workflowId: mission.workflowId, risk, verdict: tsVerdict, source: "rego-js+ts" });
      return tsVerdict;
    }

    if (opaResult === null) {
      // Sem rego/opa — TS puro
      appendAuditLog({ missionId: mission.id, workflowId: mission.workflowId, risk, verdict: tsVerdict, source: "ts-fallback" });
      return tsVerdict;
    }

    // OPA disponível — AND fail-closed
    let finalVerdict: GovernanceVerdict;
    let source: string;
    if (!opaResult.allow) {
      // OPA nega — fail-closed
      finalVerdict = {
        allowed: false,
        action: "block",
        reasons: opaResult.deny.length ? opaResult.deny : [`opa deny: ${mission.workflowId}`],
        policyId: "policy.rego",
      };
      if (!tsVerdict.allowed) {
        finalVerdict.reasons = [...finalVerdict.reasons, ...tsVerdict.reasons];
      }
      source = "opa-wasm";
    } else {
      // OPA permite — ainda precisa TS
      finalVerdict = tsVerdict;
      source = tsVerdict.allowed ? "opa-wasm+ts" : "opa-wasm+ts-fail-closed";
    }

    appendAuditLog({ missionId: mission.id, workflowId: mission.workflowId, risk, verdict: finalVerdict, source });
    return finalVerdict;
  }

  /**
   * Variante sync para uso em src/core/governance.ts (govern sync).
   * Usa evaluateRegoJS + evaluateAll — determinística sem spawn.
   */
  evaluateSync(input: RegoInput | Mission): GovernanceVerdict {
    const mission = toMission(input);
    const risk = normalizeRisk(mission);
    const tsVerdict = evaluateAll(mission, [defaultPolicy, protectedPathsPolicy, riskGovernancePolicy, behaviorLevelPolicy]);

    if (!existsSync(REGO_PATH)) {
      const v = tsVerdict;
      try { appendAuditLog({ missionId: mission.id, workflowId: mission.workflowId, risk, verdict: v, source: "ts-fallback-sync" }); } catch {}
      return v;
    }

    const js = evaluateRegoJS({ risk, workflowId: mission.workflowId, missionId: mission.id, inputs: mission.inputs });
    let finalVerdict: GovernanceVerdict;
    let source: string;
    if (!js.allow) {
      finalVerdict = {
        allowed: false,
        action: "block",
        reasons: [...js.deny, ...tsVerdict.reasons],
        policyId: "policy.rego",
      };
      source = "rego-js+ts-fail-closed-sync";
    } else {
      finalVerdict = tsVerdict;
      source = tsVerdict.allowed ? "rego-js+ts-sync" : "rego-js+ts-fail-closed-sync";
    }
    try { appendAuditLog({ missionId: mission.id, workflowId: mission.workflowId, risk, verdict: finalVerdict, source }); } catch {}
    return finalVerdict;
  }
}

// Singleton padrão
export const governancePolicy = new GovernancePolicy();

// Helper async para quem não quer instanciar classe
export async function evaluateGovernance(input: RegoInput | Mission): Promise<GovernanceVerdict> {
  return governancePolicy.evaluate(input);
}

export function evaluateGovernanceSync(input: RegoInput | Mission): GovernanceVerdict {
  return governancePolicy.evaluateSync(input);
}
