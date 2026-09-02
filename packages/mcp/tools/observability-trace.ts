import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "observability.trace",
  description: "Get trace spans for a mission via OTel provider",
  args: z.object({
    input: z.string().optional().describe("generic input for observability.trace"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "observability.trace", result: "executed observability.trace with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

