import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "gateway.invoke",
  description: "Invoke a marketplace tool via gateway with governance",
  args: z.object({
    input: z.string().optional().describe("generic input for gateway.invoke"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "gateway.invoke", result: "executed gateway.invoke with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

