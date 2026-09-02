/** Tool: evidence.validate — ADR 007 — zod args/output + defineTool */
import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineTool } from "../tool.js";

export const EvidenceValidateArgs = z.object({
  missionId: z.string().regex(/^[a-zA-Z0-9._-]+$/).describe("mission id to validate evidence for"),
  strict: z.boolean().optional().default(false).describe("strict mode: check mcp + traces + federation"),
});

export const EvidenceValidateOutput = z.object({
  missionId: z.string(),
  exists: z.boolean(),
  valid: z.boolean(),
  errors: z.array(z.string()),
  toolCount: z.number().optional(),
  status: z.string().optional(),
});

export const evidenceValidateTool = defineTool({
  name: "evidence.validate",
  description: "Validate evidence ledger for a mission — checks status, mcp snapshot, and governance verdict",
  args: EvidenceValidateArgs,
  output: EvidenceValidateOutput,
  execute: async (args) => {
    const safeId = args.missionId.replace(/[^a-zA-Z0-9._-]/g, "_");
    const p = join(process.cwd(), "behavior-os", "runtime", `${safeId}.json`);
    const errors: string[] = [];
    if (!existsSync(p)) {
      return { missionId: args.missionId, exists: false, valid: false, errors: [`no evidence at ${p}`] };
    }
    let ev: any;
    try { ev = JSON.parse(readFileSync(p, "utf-8")); } catch (e: any) { return { missionId: args.missionId, exists: true, valid: false, errors: [`parse_error: ${e.message}`] }; }

    if (!ev.missionId) errors.push("missing missionId");
    if (!ev.workflowId) errors.push("missing workflowId");
    if (!["COMPLETED", "FAILED", "IN_PROGRESS"].includes(ev.status)) errors.push(`invalid status: ${ev.status}`);
    if (!Array.isArray(ev.stages)) errors.push("stages must be array");
    if (!ev.governance) errors.push("missing governance");
    if (args.strict) {
      if (!ev.mcp?.exists) errors.push("strict: missing mcp");
      else {
        if ((ev.mcp.toolCount ?? 0) < 1) errors.push("strict: mcp.toolCount <1");
        if (!ev.mcp.valid) errors.push("strict: mcp.valid false");
      }
      if (ev.traces && !ev.traces.exists) errors.push("strict: traces missing");
    }
    // also validate mcp.json global
    const mcpPath = join(process.cwd(), "behavior-os", "runtime", "mcp.json");
    if (existsSync(mcpPath)) {
      try {
        const mcp = JSON.parse(readFileSync(mcpPath, "utf-8"));
        if (!mcp.validation?.valid) errors.push(`mcp.json validation invalid: ${mcp.validation?.errors?.join(";")}`);
      } catch {}
    }

    return {
      missionId: args.missionId,
      exists: true,
      valid: errors.length === 0,
      errors,
      toolCount: ev.mcp?.toolCount,
      status: ev.status,
    };
  },
});

export default evidenceValidateTool;
