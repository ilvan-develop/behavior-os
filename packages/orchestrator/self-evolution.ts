/** Self-Evolution Discovery — v3.5
 * Descobre gaps e propõe evolução automática quando coverage < 95.
 * Plugin usará este stub em session.idle; tson será escrito em behavior-os/runtime/.
 */
import { evaluateEvidence } from "../../src/core/evaluator.js";
import { proposeEvolution } from "../dna/evolution.js";
import { computeCoverage } from "../verification/coverage.js";
import { writeTson } from "../self-evolution/store.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Mission } from "../../src/domain/types.js";

export interface SelfEvolutionDiscovery {
  missionId: string;
  gaps: string[];
  proposals: ReturnType<typeof proposeEvolution>[];
  coverage: ReturnType<typeof computeCoverage>;
}

export function discoverSelfEvolution(missionId = "demo"): SelfEvolutionDiscovery {
  const gaps: string[] = [];
  const proposals: ReturnType<typeof proposeEvolution>[] = [];
  let evidence: any = null;
  try {
    const p = join(process.cwd(), "behavior-os", "runtime", `${missionId}.json`);
    if (existsSync(p)) evidence = JSON.parse(readFileSync(p, "utf-8"));
  } catch {}
  if (evidence) {
    const fakeMission = { id: missionId, title: "self-evolution", goal: "evoluir Behavior OS", workflowId: evidence.workflowId ?? "development", createdAt: new Date().toISOString(), inputs: {} } as Mission;
    const evalRes = evaluateEvidence(fakeMission, evidence);
    if (!evalRes.approved) {
      gaps.push(`evaluator: ${evalRes.feedback.join("; ")}`);
      const prop = proposeEvolution(evalRes, ["researcher", "qa"]);
      if (prop) proposals.push(prop);
    }
  } else {
    gaps.push("no evidence for mission");
  }
  const coverage = computeCoverage();
  if (coverage.global < 95) {
    // auto-propose evolution when global coverage < 95 (ADR 010: wf-evolved-* efémero)
    proposals.push({ kind: "new-workflow", reason: `coverage.global ${coverage.global} <95`, dnaPatch: { addStage: "evidence" } });
    gaps.push(`coverage global ${coverage.global} <95 — evolution proposed`);
  }
  if (coverage.architecture < 90) {
    gaps.push(`architecture ${coverage.architecture} <90`);
  }

  // write self-evolution tson to disk (Regra de Ouro: artefato observável)
  const snapshot: any = {
    timestamp: new Date().toISOString(),
    version: "1.3.0",
    discovery: { gaps, proposals, coverage },
    gateway: { allowed: true, reason: "self-evolution discovery", action: proposals.length > 0 ? "evolution-proposed" : "pass" },
  };
  writeTson(snapshot, join(process.cwd()));

  return { missionId, gaps, proposals, coverage };
}
