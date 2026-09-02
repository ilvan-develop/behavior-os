import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "governance.policyList",
  description: "List governance policies and verdicts for audit",
  args: z.object({
    input: z.string().optional().describe("generic input for governance.policyList"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "governance.policyList", result: "executed governance.policyList with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

