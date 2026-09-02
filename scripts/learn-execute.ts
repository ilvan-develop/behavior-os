import { planTeam } from "../packages/orchestrator/planner.ts";
import { generateWorkflow } from "../packages/orchestrator/workflow-generator.ts";
import { runWorkflow } from "../src/workflow/engine.ts";
import { evidenceLedger } from "../src/core/evidence-ledger.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

async function main(){
  console.log("[learn-execute] executar incremento aprendido — modo autónomo");
  const objective = "Implementar feature flag para learn sprint";
  const team = planTeam(objective, ["implementation", "verification"]);
  console.log("[learn] team:", team.join(", "));
  const wf = generateWorkflow("LEARN-EXEC", team);
  console.log("[learn] workflow efémero:", wf.id, wf.stages.map(s=>s.id).join("→"));
  // salva workflow efémero para evidence
  const wfPath = join(process.cwd(), "behavior-os", "workflows", `${wf.id}.json`);
  mkdirSync(dirname(wfPath), { recursive: true });
  writeFileSync(wfPath, JSON.stringify(wf, null, 2), "utf-8");
  console.log("[learn] workflow salvo:", wfPath);
  // cria missão efémera
  const mission = { id: "LEARN-EXEC", title: objective, goal: objective, workflowId: wf.id, createdAt: new Date().toISOString(), inputs: { learn: true } } as any;
  const missionPath = join(process.cwd(), "behavior-os", "missions", "LEARN-EXEC.json");
  writeFileSync(missionPath, JSON.stringify(mission, null, 2), "utf-8");
  console.log("[learn] missão criada:", missionPath);
  // executa
  const ledger = evidenceLedger(mission, wf);
  const result = await runWorkflow(wf, mission, ledger);
  console.log(`[learn] evidence: ${result.evidence.status} evaluator:${result.evaluator.coverage.overall}%`);
  console.log(`[learn] runtime: behavior-os/runtime/LEARN-EXEC.json`);
}
main();
