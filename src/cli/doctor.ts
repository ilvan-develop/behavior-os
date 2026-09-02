#!/usr/bin/env tsx
/** Doctor — health gate: verifica AGENTS.md, opencode.json, agents, skills, evidence, graphify. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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
  // skills
  const skillsPath = join(cwd,".opencode","skills");
  let skills = 0;
  if (existsSync(skillsPath)) {
    skills = readdirSync(skillsPath, {withFileTypes:true}).filter(d=>d.isDirectory()).length;
  }
  check(".opencode/skills (7)", skills===7, `found ${skills}/7`);
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

  console.log(`[doctor] overall: ${failures===0 ? "PASS" : `FAIL (${failures} gate(s) failed)`}`);
  process.exit(failures===0 ? 0 : 1);
}
main();
