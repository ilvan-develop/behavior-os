/** Mission Engine — definition → validation → execution lifecycle. */
import { readFileSync } from "node:fs";
import type { Mission, Workflow } from "../domain/types.js";
import { defaultPolicy, protectedPathsPolicy, evaluateAll } from "../domain/policies.js";
import { evidenceLedger } from "./evidence-ledger.js";
import { runWorkflow } from "../workflow/engine.js";

export function loadMission(path: string): Mission {
  const raw = readFileSync(path, "utf-8");
  const m = JSON.parse(raw) as Mission;
  if (!m.id) throw new Error(`Mission missing id in ${path}`);
  return m;
}

export function loadWorkflow(path: string): Workflow {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as Workflow;
}

export function validateMission(mission: Mission) {
  const verdict = evaluateAll(mission, [defaultPolicy, protectedPathsPolicy]);
  if (!verdict.allowed) throw new Error(`Governance denied: ${verdict.reasons.join("; ")}`);
  return verdict;
}

export async function executeMission(missionPath: string, workflowPath: string) {
  const mission = loadMission(missionPath);
  const workflow = loadWorkflow(workflowPath);
  validateMission(mission);
  const ledger = evidenceLedger(mission, workflow);
  const result = await runWorkflow(workflow, mission, ledger);
  return result;
}
