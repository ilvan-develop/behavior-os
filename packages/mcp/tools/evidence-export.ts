import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "evidence.export",
  description: "Export evidence ledger to external format for audit",
  args: z.object({
    input: z.string().optional().describe("generic input for evidence.export"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "evidence.export", result: "executed evidence.export with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

