/** Evidence Ledger — escreve behavior-os/runtime/*.json com status observável. */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Mission, Workflow, Evidence } from "../domain/types.js";
import { langGraphStatus } from "../adapters/langgraph.js";
import { govern } from "./governance.js";

export function evidencePath(missionId: string): string {
  return join(process.cwd(), "behavior-os", "runtime", `${missionId}.json`);
}

export function evidenceLedger(mission: Mission, workflow: Workflow) {
  const startedAt = new Date().toISOString();
  let stages: Evidence["stages"] = workflow.stages.map((s) => ({ stage: s.id, status: "IN_PROGRESS" as const }));

  function write(status: Evidence["status"], extra: Partial<Evidence> = {}) {
    const gov = govern(mission);
    const evidence: Evidence = {
      missionId: mission.id,
      workflowId: workflow.id,
      status,
      startedAt,
      finishedAt: status !== "IN_PROGRESS" ? new Date().toISOString() : undefined,
      stages,
      governance: { policyId: gov.policyId, verdict: gov.allowed ? "pass" : "fail", reasons: [...gov.reasons, `action:${gov.action}`] },
      graphify: (() => {
        const gp = join(process.cwd(), "graphify-out", "graph.json");
        const exists = existsSync(gp);
        let nodeCount: number | undefined;
        if (exists) try { const d = JSON.parse(readFileSync(gp,"utf-8")); nodeCount = d.nodes?.length; } catch {}
        return { graphPath: "graphify-out/graph.json", exists, nodeCount };
      })(),
      langgraph: langGraphStatus(),
      ...extra,
    };
    const p = evidencePath(mission.id);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(evidence, null, 2), "utf-8");
    return evidence;
  }

  return {
    start() { return write("IN_PROGRESS"); },
    complete() {
      stages = stages.map((s) => ({ ...s, status: "COMPLETED" as const }));
      return write("COMPLETED", { stages });
    },
    fail(reason: string) {
      const gov = govern(mission);
      return write("FAILED", { stages, governance: { policyId: gov.policyId, verdict: "fail", reasons: [...gov.reasons, reason] } });
    },
    path: evidencePath(mission.id),
  };
}
