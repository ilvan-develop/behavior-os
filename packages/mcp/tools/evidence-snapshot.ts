import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "evidence.snapshot",
  description: "Snapshot current evidence for a mission into runtime json",
  args: z.object({
    input: z.string().optional().describe("generic input for evidence.snapshot"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "evidence.snapshot", result: "executed evidence.snapshot with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

