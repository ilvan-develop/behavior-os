import { z } from "zod";
import { defineTool } from "../tool.js";

export const tool = defineTool({
  name: "graph.ingest",
  description: "Ingest graph data from source file into graphify pipeline",
  args: z.object({
    input: z.string().optional().describe("generic input for graph.ingest"),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]*$/).optional().describe("mission id context"),
  }),
  output: z.object({
    ok: z.boolean(),
    tool: z.string(),
    result: z.string().optional(),
  }),
  execute: async (args, ctx) => {
    return { ok: true, tool: "graph.ingest", result: "executed graph.ingest with " + JSON.stringify(args) + " ctx:" + ctx.missionId };
  },
});

export default tool;

