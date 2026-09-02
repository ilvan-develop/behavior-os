/** Orchestrator — selects workflow stages and delegates to agents/skills.
 * v1.4: suporta parallelGroups (orchestrator-workers via Promise.all).
 * v2.2: delega com governança e mentalidade Behavior (level 0-7) por workflow.
 */
import type { Workflow, Mission } from "../domain/types.js";
import { createWorkflowState, advance } from "../workflow/state.js";
import { governanceForWorkflow } from "./governance.js";
import { resolveDna } from "../../packages/dna/resolver.js";

export interface OrchestratorResult {
  workflowId: string;
  missionId: string;
  trace: string[];
  parallel?: boolean;
}

export async function orchestrate(workflow: Workflow, mission: Mission): Promise<OrchestratorResult> {
  const gov = governanceForWorkflow(workflow.id);
  const dna = resolveDna(workflow.stages[0]?.agent ?? "researcher", workflow.id);
  if (workflow.parallelGroups && workflow.parallelGroups.length > 0) {
    return orchestrateParallel(workflow, mission);
  }
  const state = createWorkflowState(workflow, mission);
  const trace: string[] = [`start:${workflow.id}:level${gov.level}:risk${gov.risk}`];
  trace.push(`dna:${dna.invariants.slice(0, 2).join(",")}`);
  let current = workflow.stages[0]?.id;
  while (current) {
    trace.push(`enter:${current}`);
    const nextAgent = workflow.handoffs[current];
    if (nextAgent) trace.push(`handoff:${current}->${nextAgent} (gov:${gov.requiresApproval ? "approval" : "allow"})`);
    advance(state, current);
    const idx = workflow.stages.findIndex((s) => s.id === current);
    current = workflow.stages[idx + 1]?.id;
  }
  trace.push("end");
  return { workflowId: workflow.id, missionId: mission.id, trace };
}

export async function orchestrateParallel(workflow: Workflow, mission: Mission): Promise<OrchestratorResult> {
  const gov = governanceForWorkflow(workflow.id);
  const dna = resolveDna(workflow.stages[0]?.agent ?? "researcher", workflow.id);
  const state = createWorkflowState(workflow, mission);
  const trace: string[] = [`start:${workflow.id}:parallel:level${gov.level}`];
  trace.push(`dna:${dna.invariants.slice(0, 2).join(",")}`);
  const flatParallel = new Set(workflow.parallelGroups!.flat());
  let i = 0;
  while (i < workflow.stages.length) {
    const stage = workflow.stages[i];
    if (flatParallel.has(stage.id)) {
      const group = workflow.parallelGroups!.find((g) => g.includes(stage.id))!;
      trace.push(`parallel:start:${group.join("+")} (gov:${gov.risk})`);
      await Promise.all(
        group.map(async (sid) => {
          const s = workflow.stages.find((x) => x.id === sid)!;
          trace.push(`worker:${sid}:${s.agent}`);
          await new Promise((r) => setTimeout(r, 5));
          advance(state, sid);
        })
      );
      trace.push(`parallel:end:${group.join("+")}->synthesize`);
      i = workflow.stages.findIndex((s) => s.id === group[group.length - 1]) + 1;
    } else {
      trace.push(`enter:${stage.id}`);
      const nextAgent = workflow.handoffs[stage.id];
      if (nextAgent) trace.push(`handoff:${stage.id}->${nextAgent}`);
      advance(state, stage.id);
      await new Promise((r) => setTimeout(r, 3));
      i++;
    }
  }
  trace.push("end:parallel");
  return { workflowId: workflow.id, missionId: mission.id, trace, parallel: true };
}
