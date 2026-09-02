/** Tool factory — adapter único que importa zod (ADR 007) */
import { z } from "zod";
import type { Tool, ToolSchemaDef, ToolContext, DefineToolDef } from "../../src/domain/mcp.js";

export const ToolArgsSchema = z.object({
  action: z.enum(["status", "run-demo", "doctor", "evidence"]).describe("ação do control plane"),
  missionId: z.string().regex(/^[a-zA-Z0-9._-]+$/).optional().describe("mission id para evidence lookup"),
});

export const BehaviorOsToolDef: ToolSchemaDef = {
  name: "behaviorOS",
  description: "behaviorOS control plane — run mission, check evidence, report status",
  args: z.object({
    action: z.enum(["status", "run-demo", "doctor", "evidence"]),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]+$/).optional(),
  }),
  output: z.string(),
};

function isZodObject(v: unknown): boolean {
  return !!v && typeof (v as any).parse === "function" && typeof (v as any).safeParse === "function";
}
export function defineTool<TArgs, TOutput>(def: DefineToolDef<TArgs, TOutput>): Tool<TArgs, TOutput> {
  if (!def.name || !def.description) throw new Error("Tool requires name and description");
  if (!def.args || !isZodObject(def.args)) throw new Error(`Tool ${def.name}: args must be z.ZodObject`);
  return {
    name: def.name,
    description: def.description,
    schema: { name: def.name, description: def.description, args: def.args, output: def.output },
    validate(args: unknown): TArgs {
      return def.args.parse(args) as TArgs;
    },
    async execute(args: TArgs, ctx: ToolContext): Promise<TOutput> {
      return def.execute(args, ctx);
    },
  };
}
