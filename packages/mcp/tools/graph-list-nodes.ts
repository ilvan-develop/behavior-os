import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "graph.listNodes",
  description: "List nodes from knowledge graph with pagination",
  args: z.object({
    input: z.string().optional().describe("generic input for graph.listNodes"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "graph.listNodes", result: "executed graph.listNodes with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

