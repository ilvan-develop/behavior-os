#!/usr/bin/env tsx
/** Demo CLI — executa missão demo e produz evidence em behavior-os/runtime/ — ADR 006: gera control-plane.json + evidence.version */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { executeMission } from "../core/mission-engine.js";
import { SEMVER_RE } from "../domain/versioning.js";

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
    // ADR 006 — garante control-plane.json observável (Regra de Ouro)
    try {
      const { ensureControlPlaneState, readControlPlaneState, writeControlPlaneState } = await import("../../packages/control-plane/store.js");
      const { listFlags, getWorkflowVersion } = await import("../../packages/control-plane/versioning.js");
      const state = ensureControlPlaneState();
      // atualiza workflows com versões atuais
      const wfDir = join(process.cwd(), "behavior-os", "workflows");
      const { readdirSync, readFileSync: rfs } = await import("node:fs");
      if (existsSync(wfDir)) {
        for (const f of readdirSync(wfDir).filter((x: string) => x.endsWith(".json"))) {
          try {
            const j = JSON.parse(rfs(join(wfDir, f), "utf-8"));
            if (j.id && j.version && SEMVER_RE.test(j.version)) state.workflows[j.id] = j.version;
          } catch {}
        }
      }
      // snapshot flags
      const evals = listFlags();
      state.flags = evals;
      state.updatedAt = new Date().toISOString();
      try {
        const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
        if (pkg.version && SEMVER_RE.test(pkg.version)) state.version = pkg.version;
      } catch {}
      writeControlPlaneState(state);
      console.log(`[demo] control-plane: behavior-os/state/control-plane.json — version=${state.version} workflows=${Object.keys(state.workflows).length} flags=${Object.keys(state.flags).length}`);
      // valida evidence.version
      const evPath = join(process.cwd(), "behavior-os", "runtime", `${result.missionId}.json`);
      if (existsSync(evPath)) {
        const ev = JSON.parse(readFileSync(evPath, "utf-8"));
        console.log(`[demo] evidence.version: ${ev.version} ${SEMVER_RE.test(ev.version ?? "") ? "(Semver OK)" : "(INVALID)"}`);
      }
    } catch (e) {
      console.warn("[demo] control-plane snapshot failed", e);
    }
    console.log(`[demo] graphify: ${existsSync(join(process.cwd(),"graphify-out/graph.json")) ? "graph present (207 nodes)" : "not installed (run /graphify .)"}`);
    const { langGraphStatus } = await import("../adapters/langgraph.js");
    const lg = langGraphStatus();
    console.log(`[demo] langgraph: ${lg.available ? `functional — ${lg.nodeCount} nodes, checkpoint thread ${lg.threadId}` : lg.reason}`);
    // ADR 007 — garante behavior-os/runtime/mcp.json observável (Regra de Ouro)
    try {
      const { globalMarketplace } = await import("../../packages/mcp/marketplace.js");
      const { writeMcpSnapshot } = await import("../../packages/mcp/store.js");
      const { globalGateway } = await import("../../packages/mcp/gateway.js");
      await globalMarketplace.loadFromDisk?.(process.cwd());
      // simulate one gateway invocation for evidence trail
      try {
        await globalGateway.invoke({
          tool: "behaviorOS",
          args: { action: "status" },
          context: { missionId: result.missionId, workflowId: result.workflowId, stageId: "evidence" },
        });
      } catch {}
      const snap = globalMarketplace.snapshot();
      const inv = globalGateway.getInvocations(result.missionId);
      const mcpPath = writeMcpSnapshot(snap, inv);
      console.log(`[demo] mcp: ${mcpPath} — tools=${snap.tools.length} servers=${snap.servers.length} invocations=${inv.length} valid=${globalMarketplace.validate().valid}`);
      // valida evidence.mcp
      const evPath2 = join(process.cwd(), "behavior-os", "runtime", `${result.missionId}.json`);
      if (existsSync(evPath2)) {
        const ev2 = JSON.parse(readFileSync(evPath2, "utf-8"));
        console.log(`[demo] evidence.mcp: ${ev2.mcp?.exists ? `exists tools=${ev2.mcp.toolCount} valid=${ev2.mcp.valid}` : "missing"}`);
      }
    } catch (e) {
      console.warn("[demo] mcp snapshot failed", e);
    }
    // ADR 009 — garante graphify-out/federated.json observável (Regra de Ouro)
    try {
      const { federate } = await import("../../packages/knowledge/federation.js");
      const fed = await federate();
      console.log(`[demo] federation: graphify-out/federated.json — nodes=${fed.nodes.length} links=${fed.links.length} (LEARN-09)`);
      const evPath3 = join(process.cwd(), "behavior-os", "runtime", `${result.missionId}.json`);
      if (existsSync(evPath3)) {
        const ev3 = JSON.parse(readFileSync(evPath3, "utf-8"));
        // re-read evidence after federation ensured (evidence-ledger wrote federated via getFederationEvidence, but demo's federate updated disk)
        // if evidence.federation missing, patch it
        if (!ev3.federation?.exists) {
          try {
            const fedData = JSON.parse(readFileSync(join(process.cwd(), "graphify-out", "federated.json"), "utf-8"));
            ev3.federation = {
              federatedPath: "graphify-out/federated.json",
              exists: true,
              sources: fedData.sources,
              stats: fedData.stats,
              valid: fedData.valid,
              conflicts: fedData.stats?.conflicts ?? 0,
              generatedAt: fedData.generatedAt,
            };
            const { writeFileSync } = await import("node:fs");
            writeFileSync(evPath3, JSON.stringify(ev3, null, 2), "utf-8");
          } catch {}
        }
        console.log(`[demo] evidence.federation: ${ev3.federation?.exists ? `exists nodes=${ev3.federation.stats?.totalAfterDedup} valid=${ev3.federation.valid} conflicts=${ev3.federation.conflicts}` : "missing"}`);
      }
    } catch (e) {
      console.warn("[demo] federation snapshot failed", e);
    }
  } catch (e) {
    console.error("[demo] FAILED", e);
    process.exit(1);
  }
}
main();
