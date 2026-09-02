import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "knowledge.retrieve",
  description: "Retrieve knowledge chunks via vector/graph retrieval",
  args: z.object({
    input: z.string().optional().describe("generic input for knowledge.retrieve"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "knowledge.retrieve", result: "executed knowledge.retrieve with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

