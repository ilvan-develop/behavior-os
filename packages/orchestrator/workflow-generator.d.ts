/** Workflow Generator — v3.1
 * Gera WorkflowSpec efémero a partir de mission + team (não JSON estático).
 * Cada Stage tem contrato {input,actor,capabilities,output,acceptance,evidence,next}.
 */
import type { Workflow } from "../../src/domain/types.js";
export declare function generateWorkflow(missionId: string, team: string[]): Workflow;
