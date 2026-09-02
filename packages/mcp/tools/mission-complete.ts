import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "mission.complete",
  description: "Complete a mission by marking stages completed and writing evidence",
  args: z.object({
    input: z.string().optional().describe("generic input for mission.complete"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "mission.complete", result: "executed mission.complete with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

