#!/usr/bin/env tsx
/** Brainstorm — modo autónomo com fluxo de ideias */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { runWorkflow } from "../src/workflow/engine.ts";
import { evidenceLedger } from "../src/core/evidence-ledger.ts";
import { planTeam } from "../packages/orchestrator/planner.ts";
import { generateWorkflow } from "../packages/orchestrator/workflow-generator.ts";

async function main() {
  console.log("[brainstorm] modo autónomo — gerando ideias enterprise");
  const mission = JSON.parse(readFileSync("behavior-os/missions/brainstorm-enterprise.json", "utf-8"));
  const workflow = JSON.parse(readFileSync("behavior-os/workflows/brainstorm.json", "utf-8"));
  const team = planTeam(mission.goal);
  console.log(`[brainstorm] team para "${mission.goal.slice(0,40)}..." → ${team.join(", ")}`);
  const ledger = evidenceLedger(mission, workflow);
  const result = await runWorkflow(workflow, mission, ledger);
  console.log(`[brainstorm] workflow ${workflow.id} → ${result.evidence.status} — ${result.evidence.stages.length} stages`);

  // ideias geradas (simuladas via planner + knowledge, em produção seria LLM)
  const ideas = [
    "1. RBAC fino por stage (researcher read-only, implementer edit, security approve) com ABAC por risk",
    "2. Audit log imutável em behavior-os/runtime/audit.log (hash chain, GDPR)",
    "3. SSO OIDC + SCIM para enterprise (workspaces multi-tenant)",
    "4. Observability: OpenTelemetry traces por stage + LangSmith-like dashboard",
    "5. Control Plane: versioning de workflows/*.json + feature flags para rollout canário",
    "6. MCP Marketplace: behavior-os-mcp com 10 tools (mission.create, evidence.get, graph.query)",
    "7. SDK @behavior-os/sdk para my-saas importar sem CLI (ports já em packages/adapters/ports.ts)",
    "8. Knowledge Federation: graphify-out + global graph para mono-repos multi-equipe",
    "9. Policy as Code: OPA/Rego para governance (ex: high risk → security-audit obrigatório)",
    "10. Self-healing: evaluator propõe workflow efémero quando coverage <95 (já em packages/dna/evolution.ts)",
  ];
  console.log("[brainstorm] 10 ideias enterprise:");
  ideas.forEach(i => console.log("  " + i));

  // workflow efémero para a ideia top-1 (RBAC)
  const wf = generateWorkflow("enterprise-rbac", ["researcher", "architect", "security", "qa", "orchestrator"]);
  const wfPath = join(process.cwd(), "behavior-os", "workflows", `${wf.id}.json`);
  mkdirSync(dirname(wfPath), { recursive: true });
  writeFileSync(wfPath, JSON.stringify(wf, null, 2), "utf-8");
  console.log(`[brainstorm] workflow efémero gerado: ${wfPath} — ${wf.stages.length} stages`);

  // evidence de brainstorm
  const out = join(process.cwd(), "behavior-os", "runtime", "brainstorm-enterprise.json");
  writeFileSync(out, JSON.stringify({ missionId: mission.id, workflowId: workflow.id, team, ideas, workflow: wf, timestamp: new Date().toISOString() }, null, 2), "utf-8");
  console.log(`[brainstorm] evidence: ${out}`);
}

main();
