/** Self-Evolution Discovery — v3.4
 * Descobre gaps sem escrever (apenas propõe). Plugin usará este stub em session.idle.
 */
import { evaluateEvidence } from "../../src/core/evaluator.js";
import { proposeEvolution } from "../dna/evolution.js";
import { computeCoverage } from "../verification/coverage.js";
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
  if (coverage.global < 95) gaps.push(`coverage global ${coverage.global} <95`);
  if (coverage.architecture < 90) gaps.push(`architecture ${coverage.architecture} <90`);

  return { missionId, gaps, proposals, coverage };
}
