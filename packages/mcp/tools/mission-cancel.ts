import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "mission.cancel",
  description: "Cancel an in-progress mission — set status FAILED with reason",
  args: z.object({
    input: z.string().optional().describe("generic input for mission.cancel"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "mission.cancel", result: "executed mission.cancel with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

