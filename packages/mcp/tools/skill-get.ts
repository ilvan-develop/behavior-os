import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "skill.get",
  description: "Get skill definition by name from registry",
  args: z.object({
    input: z.string().optional().describe("generic input for skill.get"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "skill.get", result: "executed skill.get with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

