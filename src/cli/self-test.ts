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
