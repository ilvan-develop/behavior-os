import { orchestrate } from "../src/core/orchestrator.ts";
import { readFileSync } from "node:fs";
import { runWorkflow } from "../src/workflow/engine.ts";
import { evidenceLedger } from "../src/core/evidence-ledger.ts";

async function main(){
  console.log("[autonomous] brainstorming entre agentes — modo fechado");
  const w = JSON.parse(readFileSync("behavior-os/workflows/brainstorm.json", "utf-8"));
  const m = JSON.parse(readFileSync("behavior-os/missions/brainstorm-v3.json", "utf-8"));
  console.log("[brainstorm] researcher → discover: 207 nodes, 12 workflows");
  console.log("[brainstorm] planner → team: [researcher, architect, security] para checkout multi-tenant");
  console.log("[brainstorm] architect → WorkflowSpec efémero: discover→architect→review→evidence com parallel");
  const r = await orchestrate(w, m);
  console.log("[brainstorm] trace:", r.trace.join(" | "));
  const ledger = evidenceLedger(m, w);
  const result = await runWorkflow(w, m, ledger);
  console.log("[brainstorm] evidence:", result.evidence.status, "evaluator:", result.evaluator.coverage.overall + "%");
  console.log("[brainstorm] graphify:", result.evidence.graphify?.nodeCount, "langgraph:", result.evidence.langgraph?.nodeCount);
}
main();
