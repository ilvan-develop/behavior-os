/** Control Plane — versioning de workflows/*.json + feature flags (LEARN-06) — ideia #5 brainstorm */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function getWorkflowVersion(workflowId: string): string {
  const p = join(process.cwd(), "behavior-os", "workflows", `${workflowId}.json`);
  if (!existsSync(p)) return "0.0.0";
  try { return JSON.parse(readFileSync(p, "utf-8")).version ?? "0.0.0"; } catch { return "0.0.0"; }
}

export function isFeatureEnabled(flag: string): boolean {
  // feature flags simples via env ou dna
  return process.env[`FEATURE_${flag.toUpperCase()}`] === "true" || flag === "canary" ? false : true;
}
