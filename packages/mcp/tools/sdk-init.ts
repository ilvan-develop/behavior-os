import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "sdk.init",
  description: "Initialize host project with behaviorOS scaffold",
  args: z.object({
    input: z.string().optional().describe("generic input for sdk.init"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "sdk.init", result: "executed sdk.init with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

