import { orchestrate } from "../src/core/orchestrator.ts";
import { readFileSync } from "node:fs";
import { runWorkflow } from "../src/workflow/engine.ts";
import { evidenceLedger } from "../src/core/evidence-ledger.ts";

async function main(){
  console.log("[autonomous] delegar equipa para evoluir behavior-os");
  const w = JSON.parse(readFileSync("behavior-os/workflows/evolve.json", "utf-8"));
  const m = JSON.parse(readFileSync("behavior-os/missions/evolve-behavioros.json", "utf-8"));
  console.log("[evolve] delegar:", m.inputs.team.join(", "));
  const r = await orchestrate(w, m);
  console.log("[evolve] trace:", r.trace.join(" | "));
  const ledger = evidenceLedger(m, w);
  const result = await runWorkflow(w, m, ledger);
  console.log("[evolve] evidence:", result.evidence.status, "stages:", result.evidence.stages.map(s=>s.stage).join(","), "evaluator:", result.evaluator.coverage.overall + "%");
  console.log("[evolve] graphify:", result.evidence.graphify?.nodeCount, "langgraph:", result.evidence.langgraph?.nodeCount);
}
main();
