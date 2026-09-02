/** Evaluator — v1.5 Truth + Evidence + Cognitive Coverage
 * Implementa evaluator-optimizer (Anthropic pattern): geração → avaliação → refinamento até pass ou max_iter.
 * Critérios baseados em ground truth, não opinião LLM.
 */
import type { Mission, Evidence } from "../domain/types.js";
import { graphifyStatus } from "../adapters/graphify.js";
import { langGraphStatus } from "../adapters/langgraph.js";

export interface EvaluatorResult {
  approved: boolean;
  feedback: string[];
  coverage: {
    stages: { total: number; completed: number; pct: number };
    governance: "pass" | "fail";
    graphify: "functional" | "configured" | "missing";
    langgraph: "functional" | "missing";
    overall: number; // 0-100
  };
  iterations: number;
}

export function evaluateEvidence(mission: Mission, evidence: Evidence): EvaluatorResult {
  const feedback: string[] = [];
  const stagesTotal = evidence.stages.length;
  const stagesCompleted = evidence.stages.filter((s) => s.status === "COMPLETED").length;
  const stagesPct = stagesTotal ? Math.round((stagesCompleted / stagesTotal) * 100) : 0;
  if (stagesCompleted !== stagesTotal) feedback.push(`stages incomplete: ${stagesCompleted}/${stagesTotal}`);

  const gov = evidence.governance.verdict;
  if (gov !== "pass") feedback.push(`governance fail: ${evidence.governance.reasons.join("; ")}`);

  const g = graphifyStatus();
  const gState = g.functional ? "functional" : g.configured ? "configured" : "missing";
  if (!g.functional) feedback.push(`graphify not functional (expected functional)`);

  const lg = langGraphStatus();
  const lgState = lg.available ? "functional" : "missing";
  if (!lg.available) feedback.push(`langgraph not functional`);

  const overall = Math.round((stagesPct + (gov === "pass" ? 100 : 0) + (g.functional ? 100 : 0) + (lg.available ? 100 : 0)) / 4);
  const approved = feedback.length === 0 && overall === 100;

  return {
    approved,
    feedback: approved ? ["all criteria pass - truth verified"] : feedback,
    coverage: {
      stages: { total: stagesTotal, completed: stagesCompleted, pct: stagesPct },
      governance: gov,
      graphify: gState as any,
      langgraph: lgState as any,
      overall,
    },
    iterations: 1,
  };
}

export async function evaluatorOptimizer(
  mission: Mission,
  buildEvidence: () => Evidence,
  maxIter = 3
): Promise<EvaluatorResult> {
  let iterations = 0;
  let result: EvaluatorResult | null = null;
  while (iterations < maxIter) {
    iterations++;
    const evidence = buildEvidence();
    result = evaluateEvidence(mission, evidence);
    result.iterations = iterations;
    if (result.approved) break;
    // optimizer step: em produção refinaria artefatos; aqui apenas reavalia após delay
    await new Promise((r) => setTimeout(r, 5));
  }
  return result!;
}
