/** DNA Evolution — v3.2
 * Quando evaluator reprova por falta de capability, propõe novo skill/DNA.
 * Ex: workflow precisa "deploy" mas nenhum agent tem → sugere agent devops com skill deploy.
 */
import type { EvaluatorResult } from "../../src/core/evaluator.js";

export interface EvolutionProposal {
  kind: "new-skill" | "new-agent" | "new-workflow";
  reason: string;
  dnaPatch: Record<string, unknown>;
}

export function proposeEvolution(evaluator: EvaluatorResult, team: string[]): EvolutionProposal | null {
  const feedback = evaluator.feedback.join(" ").toLowerCase();
  if (feedback.includes("graphify not functional")) {
    return { kind: "new-skill", reason: "graphify missing", dnaPatch: { skill: "graphify-query", agent: "researcher" } };
  }
  if (evaluator.coverage.stages.pct < 100) {
    return { kind: "new-workflow", reason: `stages incomplete ${evaluator.coverage.stages.completed}/${evaluator.coverage.stages.total}`, dnaPatch: { addStage: "evidence" } };
  }
  // se team não cobre capability inferida, propõe novo agent
  if (team.length < 3) {
    return { kind: "new-agent", reason: "team too small for mission", dnaPatch: { agent: "planner", capability: "planning" } };
  }
  return null; // nenhum evolução necessária — truth 100%
}

export function applyEvolution(proposal: EvolutionProposal | null): string {
  if (!proposal) return "no evolution — DNA invariants preserved";
  return `evolution: ${proposal.kind} — ${proposal.reason} — patch ${JSON.stringify(proposal.dnaPatch)}`;
}
