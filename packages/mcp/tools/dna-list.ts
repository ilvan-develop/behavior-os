import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "dna.list",
  description: "List DNA files and their flags/versions",
  args: z.object({
    input: z.string().optional().describe("generic input for dna.list"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "dna.list", result: "executed dna.list with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

