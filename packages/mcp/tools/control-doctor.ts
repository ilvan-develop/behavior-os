import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "control.doctor",
  description: "Run doctor gates and return diagnostics report",
  args: z.object({
    input: z.string().optional().describe("generic input for control.doctor"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "control.doctor", result: "executed control.doctor with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

