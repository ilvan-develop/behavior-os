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
export declare function proposeEvolution(evaluator: EvaluatorResult, team: string[]): EvolutionProposal | null;
export declare function applyEvolution(proposal: EvolutionProposal | null): string;
