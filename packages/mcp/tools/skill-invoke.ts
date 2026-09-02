import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "skill.invoke",
  description: "Invoke a skill with context and track evidence",
  args: z.object({
    input: z.string().optional().describe("generic input for skill.invoke"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "skill.invoke", result: "executed skill.invoke with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

