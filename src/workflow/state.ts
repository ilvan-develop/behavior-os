/** Workflow State — typed state that flows through nodes (LangGraph-style). */
import type { Workflow, Mission } from "../domain/types.js";

export interface WorkflowState {
  workflow: Workflow;
  mission: Mission;
  currentStage: string | null;
  completed: string[];
  evidence: Record<string, unknown>;
}

export function createWorkflowState(workflow: Workflow, mission: Mission): WorkflowState {
  return { workflow, mission, currentStage: workflow.stages[0]?.id ?? null, completed: [], evidence: {} };
}

export function advance(state: WorkflowState, stageId: string): WorkflowState {
  state.completed.push(stageId);
  const idx = state.workflow.stages.findIndex((s) => s.id === stageId);
  state.currentStage = state.workflow.stages[idx + 1]?.id ?? null;
  return state;
}

export function isDone(state: WorkflowState): boolean {
  return state.currentStage === null;
}
