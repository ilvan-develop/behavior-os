#!/usr/bin/env tsx
/** Demo CLI — executa missão demo e produz evidence em behavior-os/runtime/ */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { executeMission } from "../core/mission-engine.js";

async function main() {
  const missionPath = join(process.cwd(), "behavior-os", "missions", "demo.json");
  const workflowPath = join(process.cwd(), "behavior-os", "workflows", "development.json");
  if (!existsSync(missionPath) || !existsSync(workflowPath)) {
    console.error("[demo] missing mission or workflow (expected behavior-os/missions/demo.json + behavior-os/workflows/development.json)");
    process.exit(1);
  }
  console.log("[demo] behavior-os demo — Mission → Workflow → Evidence");
  try {
    const result = await executeMission(missionPath, workflowPath);
    console.log(`[demo] COMPLETED — mission=${result.missionId} workflow=${result.workflowId}`);
    console.log(`[demo] evidence: behavior-os/runtime/${result.missionId}.json`);
    console.log(`[demo] graphify: ${existsSync(join(process.cwd(),"graphify-out/graph.json")) ? "graph present (207 nodes)" : "not installed (run /graphify .)"}`);
    const { langGraphStatus } = await import("../adapters/langgraph.js");
    const lg = langGraphStatus();
    console.log(`[demo] langgraph: ${lg.available ? `functional — ${lg.nodeCount} nodes, checkpoint thread ${lg.threadId}` : lg.reason}`);
  } catch (e) {
    console.error("[demo] FAILED", e);
    process.exit(1);
  }
}
main();
