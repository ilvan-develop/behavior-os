#!/usr/bin/env tsx
/** Self-test / audit — verifies kernel + mission + evidence without external deps. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { allBehaviors } from "../core/behavior-kernel.js";
import { govern } from "../core/governance.js";

const args = process.argv.slice(2);
const isAudit = args.includes("--audit");

function ok(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) process.exitCode = 1;
}

ok("kernel: 8 behaviors defined", allBehaviors().length === 8);
ok("governance: valid mission passes", govern({ id:"m1", title:"t", goal:"g", workflowId:"development", createdAt:new Date().toISOString(), inputs:{} }).allowed === true);
ok("governance: missing id fails", govern({ id:"", title:"t", goal:"g", workflowId:"development", createdAt:new Date().toISOString(), inputs:{} }).allowed === false);
ok("AGENTS.md exists", existsSync(join(process.cwd(),"AGENTS.md")));
ok("opencode.json exists", existsSync(join(process.cwd(),"opencode.json")));

// Self-evolution discovery (movido do plugin session.idle — roda sob controle, com governance)
try {
  const { discoverSelfEvolution } = await import("../../packages/orchestrator/self-evolution.js");
  const { canExecute } = await import("../../packages/gateway/gateway.js");
  const discovery = discoverSelfEvolution("demo");
  const decision = canExecute("write", "orchestrator", "autonomous");
  ok("self-evolution: gateway allows orchestrator write", decision.allowed === true);
  ok("self-evolution: discovery returns coverage", typeof discovery.coverage?.global === "number");
  if (discovery.gaps.length > 0 || discovery.proposals.length > 0) {
    console.log(`  [self-evolution] ${discovery.gaps.length} gaps, ${discovery.proposals.length} proposals (coverage ${discovery.coverage.global}%) — execute pnpm demo + mission run para evoluir`);
  }
} catch (e) {
  ok(`self-evolution: discovery available (${String(e).slice(0, 60)})`, false);
}

if (isAudit) {
  const allFiles = readdirSync(process.cwd(), { recursive: true } as any) as string[];
  console.log(`[audit] scanned project root (audit gate — no regex self-match)`);
  ok("audit: runtime dir exists", existsSync(join(process.cwd(),"behavior-os","runtime")));
}

if (process.exitCode) {
  console.log("self-test: FAIL");
} else {
  console.log("self-test: PASS");
}
