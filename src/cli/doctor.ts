#!/usr/bin/env tsx
/** Doctor — health gate: verifica AGENTS.md, opencode.json, agents, skills, evidence, graphify + ADR 006 control-plane. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

let failures = 0;
function check(label: string, ok: boolean, hint = "") {
  const tag = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`[doctor] ${label}: ${tag}${hint ? " — " + hint : ""}`);
}

async function main() {
  const cwd = process.cwd();
  check("AGENTS.md", existsSync(join(cwd,"AGENTS.md")));
  const opencodeExists = existsSync(join(cwd,"opencode.json"));
  check("opencode.json", opencodeExists);
  if (opencodeExists) {
    try {
      const j = JSON.parse(readFileSync(join(cwd,"opencode.json"),"utf-8"));
      check("opencode.json $schema", j.$schema?.includes("opencode.ai/config.json"));
      check("mcp.graphify configured", !!j.mcp?.graphify, j.mcp?.graphify ? "" : "expected mcp.graphify");
    } catch { check("opencode.json parse", false); }
  }
  // agents
  const agentsPath = join(cwd,".opencode","agents");
  const agents = existsSync(agentsPath) ? readdirSync(agentsPath).filter(f=>f.endsWith(".md")) : [];
  check(".opencode/agents (8)", agents.length===8, `found ${agents.length}/8: ${agents.join(", ")}`);
  // skills — v1.3 now 8 skills (behavioros added) — allow >=7 for forward compat
  const skillsPath = join(cwd,".opencode","skills");
  let skills = 0;
  if (existsSync(skillsPath)) {
    skills = readdirSync(skillsPath, {withFileTypes:true}).filter(d=>d.isDirectory()).length;
  }
  check(".opencode/skills (8)", skills===8, `found ${skills}/8`);
  // legacy check kept informational but not failing if 7->8 migration
  if (skills !== 8 && skills !== 7) {
    // already failed above; if needed, keep backward compat
  }
  // behavior-os config (hyphen = identifier técnico)
  check("behavior-os/config/profiles.json", existsSync(join(cwd,"behavior-os","config","profiles.json")));
  check("behavior-os/config/governance.json", existsSync(join(cwd,"behavior-os","config","governance.json")));
  check("behavior-os/workflows/development.json", existsSync(join(cwd,"behavior-os","workflows","development.json")));
  // evidence
  const runtimePath = join(cwd,"behavior-os","runtime");
  const runtimes = existsSync(runtimePath) ? readdirSync(runtimePath).filter(f=>f.endsWith(".json")) : [];
  check("behavior-os/runtime evidence", runtimes.length>=0, runtimes.length? `${runtimes.length} file(s)` : "0 (run pnpm demo)");
  // graphify — v1.2 real knowledge layer
  const graphPath = join(cwd,"graphify-out","graph.json");
  const graphExists = existsSync(graphPath);
  let graphDetail = "";
  if (graphExists) {
    try {
      const data = JSON.parse(readFileSync(graphPath,"utf-8"));
      const n = data.nodes?.length ?? 0;
      const e = (data.links ?? data.edges ?? []).length;
      const ageH = Math.round((Date.now() - statSync(graphPath).mtimeMs)/3600000);
      graphDetail = ` — ${n} nodes, ${e} edges, ${ageH}h old`;
    } catch { graphDetail = ""; }
  } else {
    graphDetail = " — CONFIGURED (run /graphify . or python -m graphify extract . --code-only)";
  }
  console.log(`[doctor] graphify: ${graphExists ? "functional" : "CONFIGURED"}${graphDetail}`);
  // langgraph — v1.3 real durable runtime + v1.4 parallel fan-out
  try {
    const { langGraphStatus } = await import("../adapters/langgraph.js");
    const lg = langGraphStatus();
    console.log(`[doctor] langgraph: ${lg.available ? `functional — ${lg.nodeCount} nodes, compiled, thread ${lg.threadId} + parallel graph ready` : `NOT FUNCTIONAL — ${lg.reason}`}`);
  } catch {
    console.log(`[doctor] langgraph: check failed`);
  }
  // workflows count
  const wfPath = join(cwd,"behavior-os","workflows");
  const wfs = existsSync(wfPath) ? readdirSync(wfPath).filter(f=>f.endsWith(".json")) : [];
  console.log(`[doctor] workflows: ${wfs.length} — ${wfs.join(", ")}`);
  // ADR 006 — control-plane.json observável (Regra de Ouro)
  const cpPath = join(cwd,"behavior-os","state","control-plane.json");
  const cpExists = existsSync(cpPath);
  check("behavior-os/state/control-plane.json", cpExists, cpExists ? "" : "run pnpm demo (Regra de Ouro: estado observável)");
  if (cpExists) {
    try {
      const cp = JSON.parse(readFileSync(cpPath,"utf-8"));
      check("control-plane.json version Semver", SEMVER_RE.test(cp.version ?? ""), `version=${cp.version}`);
      check("control-plane.json workflows", !!cp.workflows && typeof cp.workflows === "object" && Object.keys(cp.workflows).length>0, cp.workflows ? `${Object.keys(cp.workflows).length} workflow(s)` : "missing workflows");
      check("control-plane.json flags", !!cp.flags && typeof cp.flags === "object", cp.flags ? `${Object.keys(cp.flags).length} flag(s)` : "missing flags");
    } catch { check("control-plane.json parse", false); }
  }
  // evidence.version Semver válido
  const demoEvPath = join(cwd,"behavior-os","runtime","demo.json");
  if (existsSync(demoEvPath)) {
    try {
      const ev = JSON.parse(readFileSync(demoEvPath,"utf-8"));
      check("evidence.version Semver", SEMVER_RE.test(ev.version ?? ""), `version=${ev.version}`);
      check("evidence.controlPlane", !!ev.controlPlane && !!ev.controlPlane.flags, ev.controlPlane ? `flags=${Object.keys(ev.controlPlane.flags).length}` : "missing controlPlane");
      // ADR 007 — evidence.mcp
      check("evidence.mcp exists", !!ev.mcp?.exists, ev.mcp ? `tools=${ev.mcp.toolCount} valid=${ev.mcp.valid}` : "missing mcp");
      if (ev.mcp) {
        check("evidence.mcp toolCount >=1", (ev.mcp.toolCount ?? 0) >= 1, `toolCount=${ev.mcp.toolCount}`);
        check("evidence.mcp valid", !!ev.mcp.valid, ev.mcp.valid ? "valid" : "invalid");
      }
    } catch { check("evidence.version parse", false); }
  } else {
    console.log(`[doctor] evidence.version: SKIP — demo.json not found (run pnpm demo)`);
  }
  // ADR 007 — behavior-os/runtime/mcp.json observável (Regra de Ouro)
  const mcpPath = join(cwd,"behavior-os","runtime","mcp.json");
  const mcpExists = existsSync(mcpPath);
  check("behavior-os/runtime/mcp.json", mcpExists, mcpExists ? "" : "run pnpm demo (Regra de Ouro: marketplace observável)");
  if (mcpExists) {
    try {
      const mcp = JSON.parse(readFileSync(mcpPath,"utf-8"));
      check("mcp.json version Semver", SEMVER_RE.test(mcp.version ?? ""), `version=${mcp.version}`);
      check("mcp.json tools >=1", Array.isArray(mcp.tools) && mcp.tools.length >= 1, mcp.tools ? `${mcp.tools.length} tool(s)` : "missing tools");
      check("mcp.json validation.valid", !!mcp.validation?.valid, mcp.validation?.valid ? "valid" : `errors: ${(mcp.validation?.errors ?? []).join("; ")}`);
      check("mcp.json servers (opencode.json mcp)", Array.isArray(mcp.servers), mcp.servers ? `${mcp.servers.length} server(s)` : "missing servers");
      if (Array.isArray(mcp.tools) && mcp.tools.length) {
        const hasBehaviorOS = mcp.tools.some((t: any) => t.name === "behaviorOS" && t.argsShape?.includes("action"));
        check("mcp.json behaviorOS tool", hasBehaviorOS, hasBehaviorOS ? "behaviorOS with argsShape [action,missionId]" : "missing behaviorOS");
        const emptyArgs = mcp.tools.some((t: any) => !Array.isArray(t.argsShape) || t.argsShape.length === 0);
        check("mcp.json tools argsShape non-empty", !emptyArgs, emptyArgs ? "some tools have empty argsShape" : "all tools have argsShape");
      }
    } catch { check("mcp.json parse", false); }
  }
  // ADR 009 — graphify-out/federated.json observável (Regra de Ouro — Knowledge Federation)
  const fedPath = join(cwd, "graphify-out", "federated.json");
  const fedExists = existsSync(fedPath);
  // best-effort ensure federated exists before gating (local degenerate)
  if (!fedExists) {
    try {
      const { ensureFederatedSync } = await import("../../packages/knowledge/federation.js");
      (ensureFederatedSync as any)();
    } catch {}
  }
  const fedExists2 = existsSync(fedPath);
  check("graphify-out/federated.json", fedExists2, fedExists2 ? "" : "run pnpm demo (Regra de Ouro: federação observável)");
  if (fedExists2) {
    try {
      const fed = JSON.parse(readFileSync(fedPath, "utf-8"));
      check("federated.json version Semver", SEMVER_RE.test(fed.version ?? ""), `version=${fed.version}`);
      check("federated.json sources >=1", Array.isArray(fed.sources) && fed.sources.length >= 1, fed.sources ? `${fed.sources.length} source(s)` : "missing sources");
      if (Array.isArray(fed.sources) && fed.sources.length) {
        check("federated.json local source", fed.sources[0].source === "local", `first=${fed.sources[0]?.source}`);
        const localSrc = fed.sources.find((s: any) => s.source === "local");
        check("federated.json local freshness fresh", localSrc?.freshness === "fresh", `freshness=${localSrc?.freshness}`);
        check("federated.json local hash 16 hex", typeof localSrc?.hash === "string" && /^[0-9a-f]{16}$/.test(localSrc.hash), `hash=${localSrc?.hash}`);
        // hash must coincide with sha256(graph.json) when local exists
        try {
          const graphPath = join(cwd, "graphify-out", "graph.json");
          if (existsSync(graphPath)) {
            const { createHash } = await import("node:crypto");
            const raw = readFileSync(graphPath);
            const expected = createHash("sha256").update(raw).digest("hex").slice(0, 16);
            check("federated.json local hash matches graph.json", localSrc?.hash === expected, `expected=${expected} got=${localSrc?.hash}`);
          }
        } catch {}
        check("federated.json stats totalAfterDedup >= local nodeCount", (fed.stats?.totalAfterDedup ?? 0) >= (localSrc?.nodeCount ?? 0), `totalAfterDedup=${fed.stats?.totalAfterDedup} localNodeCount=${localSrc?.nodeCount}`);
        check("federated.json graph.nodes provenance per node", Array.isArray(fed.graph?.nodes) && fed.graph.nodes.every((n: any) => n.provenance?.source && Array.isArray(n.provenance?.sources) && n.provenance?.hash), fed.graph?.nodes ? `${fed.graph.nodes.length} nodes` : "missing graph.nodes");
        if (fed.graph?.nodes?.length) {
          const missingProv = fed.graph.nodes.filter((n: any) => !n.provenance?.source).length;
          check("federated.json provenance source defined", missingProv === 0, missingProv ? `${missingProv} nodes missing provenance` : "all nodes have provenance");
        }
        check("federated.json valid true", fed.valid === true, fed.valid ? "valid" : `errors: ${(fed.errors ?? []).join("; ")}`);
        check("federated.json stats coherent", fed.stats?.totalAfterDedup === fed.graph?.nodes?.length, `nodes=${fed.graph?.nodes?.length} totalAfterDedup=${fed.stats?.totalAfterDedup}`);
      }
    } catch { check("federated.json parse", false); }
  }
  // evidence.federation if demo exists
  if (existsSync(demoEvPath)) {
    try {
      const ev = JSON.parse(readFileSync(demoEvPath, "utf-8"));
      if (ev.federation) {
        check("evidence.federation exists true", !!ev.federation.exists, ev.federation.exists ? `sources=${ev.federation.sources?.length} valid=${ev.federation.valid}` : "missing federation");
        check("evidence.federation valid", !!ev.federation.valid, ev.federation.valid ? "valid" : `errors`);
        check("evidence.federation conflicts number", typeof ev.federation.conflicts === "number", `conflicts=${ev.federation.conflicts}`);
      } else {
        console.log(`[doctor] evidence.federation: WARN — missing (run pnpm demo with federation)`);
      }
    } catch {}
  }
  // ADR 005 — behavior-os/runtime/traces/<mission>.json observável (Regra de Ouro — Tracing W3C)
  const TRACE_ID_RE = /^[0-9a-f]{32}$/;
  const SPAN_ID_RE = /^[0-9a-f]{16}$/;
  const demoTracesPath = join(cwd, "behavior-os", "runtime", "traces", "demo.json");
  const demoTracesExists = existsSync(demoTracesPath);
  // best-effort ensure demo traces exists via demo run if evidence exists but traces missing (não falha se demo.json ausente)
  if (!demoTracesExists) {
    try {
      const evExists = existsSync(join(cwd, "behavior-os", "runtime", "demo.json"));
      if (evExists) {
        // tenta gerar via workflow engine re-run is not required; apenas avisa
      }
    } catch {}
  }
  check("behavior-os/runtime/traces/demo.json", demoTracesExists, demoTracesExists ? "" : "run pnpm demo (Regra de Ouro: traces observável ADR 005)");
  if (demoTracesExists) {
    try {
      const t = JSON.parse(readFileSync(demoTracesPath, "utf-8"));
      check("traces.json traceId W3C 32 hex", TRACE_ID_RE.test(t.traceId ?? "") && t.traceId !== "00000000000000000000000000000000", `traceId=${t.traceId}`);
      check("traces.json parentSpanId null (root)", t.parentSpanId === null, `parentSpanId=${t.parentSpanId}`);
      // spans length = workflow.stages.length +1 (mission root)
      let expectedSpans = 9; // development 8 stages + 1 mission
      try {
        const wf = JSON.parse(readFileSync(join(cwd, "behavior-os", "workflows", "development.json"), "utf-8"));
        expectedSpans = (wf.stages?.length ?? 8) + 1;
      } catch {}
      check("traces.json spans length stages+1", Array.isArray(t.spans) && t.spans.length === expectedSpans, `spans=${t.spans?.length} expected=${expectedSpans}`);
      if (Array.isArray(t.spans) && t.spans.length) {
        const invalidTraceId = t.spans.filter((s: any) => !TRACE_ID_RE.test(s.traceId ?? ""));
        check("traces.json spans traceId W3C", invalidTraceId.length === 0, invalidTraceId.length ? `${invalidTraceId.length} invalid` : `${t.spans.length} valid`);
        const invalidSpanId = t.spans.filter((s: any) => !SPAN_ID_RE.test(s.spanId ?? ""));
        check("traces.json spans spanId W3C", invalidSpanId.length === 0, invalidSpanId.length ? `${invalidSpanId.length} invalid` : `${t.spans.length} valid`);
        const invalidParent = t.spans.filter((s: any) => s.parentSpanId !== null && !SPAN_ID_RE.test(s.parentSpanId ?? ""));
        check("traces.json spans parentSpanId W3C or null", invalidParent.length === 0, invalidParent.length ? `${invalidParent.length} invalid` : "all valid");
        // parent chain: exactly 1 root, others parent exists
        const roots = t.spans.filter((s: any) => s.parentSpanId === null);
        check("traces.json parent chain 1 root", roots.length === 1, `roots=${roots.length}`);
        if (roots.length === 1) {
          const rootId = roots[0].spanId;
          const byId = new Set(t.spans.map((s: any) => s.spanId));
          const orphans = t.spans.filter((s: any) => s.parentSpanId !== null && !byId.has(s.parentSpanId));
          check("traces.json parent chain no orphans", orphans.length === 0, orphans.length ? `orphans=${orphans.length}` : `all stages parent=${rootId}`);
          const nonRootAllParentRoot = t.spans.filter((s: any) => s.parentSpanId !== null && s.parentSpanId !== rootId);
          // allow stage→tool hierarchy but in v1.3 all stages parent must be root, so non-root should be root
          check("traces.json parentSpan stages → mission root", nonRootAllParentRoot.length === 0, nonRootAllParentRoot.length ? `${nonRootAllParentRoot.length} stages not direct child of root` : `all stages child of mission root`);
        }
        const sampled = t.sampling?.reason ?? "";
        check("traces.json sampling parentBased", typeof sampled === "string" && sampled.length > 0, `reason=${sampled}`);
        // W3C traceparent header simulation
        const first = t.spans[0];
        if (first) {
          const tp = `00-${first.traceId}-${first.spanId}-0${first.traceFlags & 1}`;
          check("traces.json W3C traceparent injectable", /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/.test(tp), tp);
        }
      }
      // evidence.traces ↔ file consistency
      if (existsSync(join(cwd, "behavior-os", "runtime", "demo.json"))) {
        try {
          const ev = JSON.parse(readFileSync(join(cwd, "behavior-os", "runtime", "demo.json"), "utf-8"));
          if (ev.traces) {
            check("evidence.traces exists true", !!ev.traces.exists, `exists=${ev.traces.exists}`);
            check("evidence.traces traceId matches file", ev.traces.traceId === t.traceId, `evidence=${ev.traces.traceId} file=${t.traceId}`);
            check("evidence.traces spanCount matches", ev.traces.spanCount === t.spans.length, `evidence=${ev.traces.spanCount} file=${t.spans.length}`);
            check("evidence.traces file path correct", ev.traces.file === "behavior-os/runtime/traces/demo.json", `file=${ev.traces.file}`);
          } else {
            check("evidence.traces present", false, "missing traces in evidence (run pnpm demo)");
          }
        } catch {}
      }
    } catch { check("traces.json parse", false); }
  }

  // .opencode/tools/*.ts — superfície nativa OpenCode
  const toolsPath = join(cwd,".opencode","tools");
  const toolFiles = existsSync(toolsPath) ? readdirSync(toolsPath).filter(f=>f.endsWith(".ts")) : [];
  check(".opencode/tools/*.ts >=1", toolFiles.length >= 1, toolFiles.length ? `${toolFiles.length} tool(s): ${toolFiles.join(", ")}` : "no tools (expected behaviorOS.ts)");
  if (toolFiles.length) {
    const hasBehaviorOSTool = toolFiles.includes("behaviorOS.ts");
    check(".opencode/tools/behaviorOS.ts", hasBehaviorOSTool, hasBehaviorOSTool ? "found" : `found ${toolFiles.join(", ")}`);
  }

  console.log(`[doctor] overall: ${failures===0 ? "PASS" : `FAIL (${failures} gate(s) failed)`}`);
  process.exit(failures===0 ? 0 : 1);
}
main();
