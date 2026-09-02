import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "store.write",
  description: "Write artifact to behavior-os runtime store",
  args: z.object({
    input: z.string().optional().describe("generic input for store.write"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "store.write", result: "executed store.write with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

