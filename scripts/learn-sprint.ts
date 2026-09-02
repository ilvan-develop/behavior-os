import { readFileSync } from "node:fs";
import { orchestrate } from "../src/core/orchestrator.ts";
import { runWorkflow } from "../src/workflow/engine.ts";
import { evidenceLedger } from "../src/core/evidence-ledger.ts";
import { discoverSelfEvolution } from "../packages/orchestrator/self-evolution.ts";
import { retrieve } from "../packages/knowledge/retrieval.ts";
import { remember } from "../packages/knowledge/memory.ts";

async function main(){
  console.log("[learn-sprint] modo autónomo — descobrir para execução");
  const w = JSON.parse(readFileSync("behavior-os/workflows/learn.json","utf-8"));
  const m = JSON.parse(readFileSync("behavior-os/missions/learn-sprint.json","utf-8"));
  // 1. Discover — knowledge + memory + graph
  const retr = retrieve(m.id);
  console.log(`[learn] discover: graph ${retr.graph.nodeCount} nodes, memory ${retr.memory.length}, evidence ${retr.evidenceCount}`);
  const disc = discoverSelfEvolution("demo");
  console.log(`[learn] discoverSelfEvolution: gaps=${disc.gaps.length} coverage=${disc.coverage.global}%`);
  // 2. Brainstorm paralelo (learn + plan)
  console.log("[learn] brainstorm: researcher↔planner↔architect em parallel (learn+plan)");
  const r = await orchestrate(w, m);
  console.log("[learn] trace:", r.trace.join(" | "));
  // 3. Aprender — guarda lição em memory
  remember({ missionId: m.id, lesson: `learn sprint: discover ${retr.graph.nodeCount} nodes → plan team → execute`, timestamp: new Date().toISOString(), tags: ["learn","autonomous"] });
  console.log("[learn] memory: lesson guardada");
  // 4. Executar workflow learn com evidence
  const ledger = evidenceLedger(m, w);
  const result = await runWorkflow(w, m, ledger);
  console.log(`[learn] evidence: ${result.evidence.status} evaluator:${result.evaluator.coverage.overall}%`);
  console.log(`[learn] learn sprint concluído — próximo: executar com team ${r.trace.filter(t=>t.includes("worker")).join(",")}`);
}
main();
