import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "observability.metrics",
  description: "Get observability metrics for marketplace",
  args: z.object({
    input: z.string().optional().describe("generic input for observability.metrics"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "observability.metrics", result: "executed observability.metrics with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

