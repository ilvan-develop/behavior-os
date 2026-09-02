/** Workflow Generator — v3.1
 * Gera WorkflowSpec efémero a partir de mission + team (não JSON estático).
 * Cada Stage tem contrato {input,actor,capabilities,output,acceptance,evidence,next}.
 */
import type { Workflow, WorkflowStage } from "../../src/domain/types.js";

export function generateWorkflow(missionId: string, team: string[]): Workflow {
  const stageMap: Record<string, { skill: string; gated: boolean }> = {
    researcher: { skill: "discover", gated: false },
    planner: { skill: "planning", gated: false },
    architect: { skill: "architecture", gated: false },
    implementer: { skill: "implementation", gated: false },
    qa: { skill: "verification", gated: true },
    security: { skill: "security", gated: true },
    reviewer: { skill: "verification", gated: true },
    mobile: { skill: "implementation", gated: false },
    devops: { skill: "implementation", gated: false },
    orchestrator: { skill: "evidence", gated: true },
  };
  const stages: WorkflowStage[] = team.map((agent) => ({
    id: agent === "researcher" ? "discover" : agent === "planner" ? "plan" : agent === "architect" ? "architect" : agent === "implementer" ? "implement" : agent === "qa" ? "test" : agent,
    agent,
    skill: stageMap[agent]?.skill ?? "discover",
    gated: stageMap[agent]?.gated ?? false,
  }));
  // garante discover primeiro e evidence último
  if (!stages.find((s) => s.id === "discover")) stages.unshift({ id: "discover", agent: "researcher", skill: "discover", gated: false });
  if (!stages.find((s) => s.agent === "orchestrator")) stages.push({ id: "evidence", agent: "orchestrator", skill: "evidence", gated: true });

  const handoffs: Record<string, string> = {};
  for (let i = 0; i < stages.length - 1; i++) handoffs[stages[i].id] = stages[i + 1].agent;

  return {
    id: `wf-${missionId}`,
    version: "3.1.0",
    stages,
    handoffs,
    parallelGroups: team.includes("qa") && team.includes("security") ? [["test", "security"]] : undefined,
  } as Workflow & { behaviorLevel?: number };
}
