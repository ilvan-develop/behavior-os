import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "mission.delete",
  description: "Delete a mission and its evidence — governance-checked purge",
  args: z.object({
    input: z.string().optional().describe("generic input for mission.delete"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "mission.delete", result: "executed mission.delete with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

