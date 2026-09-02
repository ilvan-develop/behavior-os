/** Tool: governance.policyCheck — ADR 007 — zod args/output + defineTool */
import { z } from "zod";
import { defineTool } from "../tool.js";

export const GovernancePolicyCheckArgs = z.object({
  tool: z.string().min(1).describe("tool name to check governance for"),
  agent: z.string().min(1).describe("agent id requesting execution"),
  workflowId: z.string().min(1).describe("workflow id context"),
  stageId: z.string().optional().describe("stage id context"),
});

export const GovernancePolicyCheckOutput = z.object({
  allowed: z.boolean(),
  action: z.enum(["block", "escalate", "warn", "log", "pass"]),
  policyId: z.string(),
  reasons: z.array(z.string()),
  evidence: z.string().optional(),
});

export const governancePolicyCheckTool = defineTool({
  name: "governance.policyCheck",
  description: "Evaluate policy-as-code for tool execution — governance gate via policy engine before invoke",
  args: GovernancePolicyCheckArgs,
  output: GovernancePolicyCheckOutput,
  execute: async (args) => {
    // lazy import to keep tool pure and avoid circular deps
    const { canExecute } = await import("../../gateway/gateway.js");
    const verdict = canExecute(args.tool, args.agent, args.workflowId);
    return {
      allowed: verdict.allowed,
      action: (verdict as any).action ?? (verdict.allowed ? "pass" : "block"),
      policyId: (verdict as any).policyId ?? "default",
      reasons: (verdict as any).reasons ?? [(verdict as any).reason ?? "evaluated"],
      evidence: (verdict as any).evidence,
    };
  },
});

export default governancePolicyCheckTool;
