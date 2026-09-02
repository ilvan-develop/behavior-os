import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "workflow.generate",
  description: "Generate workflow JSON from mission goal via planner",
  args: z.object({
    input: z.string().optional().describe("generic input for workflow.generate"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "workflow.generate", result: "executed workflow.generate with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

