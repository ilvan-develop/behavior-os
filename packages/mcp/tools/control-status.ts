import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "control.status",
  description: "Get control plane status and version flags",
  args: z.object({
    input: z.string().optional().describe("generic input for control.status"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "control.status", result: "executed control.status with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

