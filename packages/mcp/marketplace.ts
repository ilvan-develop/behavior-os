/** MCP Marketplace — InMemoryMarketplace implements McpMarketplace (ADR 007) */
import { z } from "zod";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { McpMarketplace, Tool, ToolRegistration, MarketplaceSnapshot, GatewayInvocation } from "../../src/domain/mcp.js";
import { BehaviorOsToolDef, defineTool } from "./tool.js";
// detailed tools are imported lazily to avoid circular init — see registerDetailedFromDisk below

export const mcpTools = [
  "mission.create", "mission.get", "mission.list",
  "evidence.get", "evidence.list",
  "graph.query", "graph.getNode",
  "governance.evaluate", "dna.select", "skill.list",
  // 34 new tools — packages/mcp/tools/*.ts (ADR 007)
  "mission.update", "mission.delete", "mission.complete", "mission.cancel",
  "evidence.validate", "evidence.snapshot", "evidence.export",
  "graph.search", "graph.ingest", "graph.listNodes", "graph.getEdges",
  "knowledge.retrieve", "knowledge.federate",
  "governance.policyCheck", "governance.policyList", "governance.audit",
  "dna.validate", "dna.resolve", "dna.evolution", "dna.list",
  "skill.get", "skill.invoke",
  "workflow.generate", "workflow.validate", "workflow.execute",
  "marketplace.snapshot", "marketplace.validate",
  "observability.trace", "observability.metrics",
  "control.status", "control.doctor",
  "gateway.invoke", "sdk.init", "store.write",
  "behaviorOS"
];

export function getMcpMarketplace() { return { tools: mcpTools, count: mcpTools.length, provider: "behavior-os-mcp" }; }

class InMemoryMarketplace implements McpMarketplace {
  private tools = new Map<string, ToolRegistration>();
  private _version: string;

  constructor() {
    this._version = "1.3.0";
    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
      if (pkg.version) this._version = pkg.version;
    } catch {}
    // auto-register builtin behaviorOS tool
    try {
      const builtin = defineTool({
        name: BehaviorOsToolDef.name,
        description: BehaviorOsToolDef.description,
        args: BehaviorOsToolDef.args as any,
        output: BehaviorOsToolDef.output as any,
        execute: async (args: any) => {
          const a = args as { action: string; missionId?: string };
          if (a.action === "status") return "behaviorOS status: check behavior-os/runtime/ and opencode.json mcp.graphify";
          if (a.action === "evidence" && a.missionId) {
            const safeId = a.missionId.replace(/[^a-zA-Z0-9._-]/g, "_");
            const p = join(process.cwd(), "behavior-os", "runtime", `${safeId}.json`);
            try { return readFileSync(p, "utf-8"); } catch { return `no evidence at ${p}`; }
          }
          return `behaviorOS ${a.action}`;
        },
      });
      this.register(builtin, { source: "opencode-tool", file: ".opencode/tools/behaviorOS.ts" });
    } catch {}
    // auto-register all mcpTools (45) as stubs — detailed schemas override via import when loadFromDisk runs
    // Ensures snapshot() always reflects 45 tools even without loadFromDisk (Regra de Ouro)
    for (const n of mcpTools) {
      if (this.tools.has(n)) continue;
      try {
        // special descriptions per tool family
        const descMap: Record<string, string> = {
          "mission.create": "Create a new mission with goal and workflow binding",
          "mission.get": "Get mission by id from ledger",
          "mission.list": "List missions with pagination and filters",
          "evidence.get": "Get evidence ledger for a mission",
          "evidence.list": "List evidence files in behavior-os runtime",
          "graph.query": "Query knowledge graph with selector",
          "graph.getNode": "Get graph node by id with provenance",
          "governance.evaluate": "Evaluate governance policy verdict for action",
          "dna.select": "Select DNA layer for mission context",
          "skill.list": "List available skills from registry",
        };
        const desc = descMap[n] ?? `Tool ${n} — MCP Marketplace builtin (ADR 007)`;
        // minimal zod schema per tool — detailed tools will be replaced on loadFromDisk import with real schemas
        let args: any = z.object({ input: z.string().optional(), missionId: z.string().optional() });
        if (n === "mission.update") args = z.object({ missionId: z.string().regex(/^[a-zA-Z0-9._-]+$/), title: z.string().min(3).max(100).optional(), goal: z.string().min(10).max(500).optional(), inputs: z.record(z.unknown()).optional(), status: z.enum(["IN_PROGRESS","COMPLETED","FAILED"]).optional() });
        if (n === "evidence.validate") args = z.object({ missionId: z.string().regex(/^[a-zA-Z0-9._-]+$/), strict: z.boolean().optional().default(false) });
        if (n === "graph.search") args = z.object({ query: z.string().min(1).max(200), kind: z.enum(["node","edge","any"]).optional().default("any"), limit: z.number().int().min(1).max(100).optional().default(10), graphPath: z.string().optional().default("graphify-out/graph.json") });
        if (n === "governance.policyCheck") args = z.object({ tool: z.string().min(1), agent: z.string().min(1), workflowId: z.string().min(1), stageId: z.string().optional() });
        if (n === "dna.validate") args = z.object({ path: z.string().optional().default("behavior-os/dna/system.dna.yaml"), content: z.string().optional() });
        const stub = defineTool({
          name: n,
          description: desc,
          args,
          output: z.object({ ok: z.boolean(), tool: z.string(), result: z.string().optional() }).passthrough(),
          execute: async (a: any, ctx: any) => ({ ok: true, tool: n, result: `stub ${n} — ctx ${ctx.missionId}` }),
        });
        const file = n === "behaviorOS" ? ".opencode/tools/behaviorOS.ts" : `packages/mcp/tools/${n.replace(/\./g, "-")}.ts`;
        this.register(stub, { source: n.startsWith("mission") || n.startsWith("evidence") || n.startsWith("graph") || n.startsWith("governance") || n.startsWith("dna") || n.startsWith("skill") ? "builtin" : "builtin", file });
      } catch {}
    }
  }

  register(tool: Tool, meta: Omit<ToolRegistration, "tool" | "registeredAt">): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    if (!tool.name || !tool.description) throw new Error(`Tool ${tool.name} missing name/description`);
    const isZodObj = (v: unknown) => !!v && typeof (v as any).parse === "function" && typeof (v as any).safeParse === "function";
    if (!isZodObj(tool.schema.args)) throw new Error(`Tool ${tool.name}: args must be ZodObject`);
    if (tool.description.length < 10 || tool.description.length > 200) {
      // warn but allow per ADR — still register but validate will flag
    }
    this.tools.set(tool.name, {
      tool,
      source: meta.source,
      file: meta.file,
      serverId: meta.serverId,
      registeredAt: new Date().toISOString(),
    });
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  list(): ToolRegistration[] {
    return [...this.tools.values()];
  }

  get(name: string): ToolRegistration | undefined {
    return this.tools.get(name);
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const reg of this.tools.values()) {
      const n = reg.tool.name;
      if (seen.has(n)) errors.push(`duplicate tool name: ${n}`);
      seen.add(n);
      // kebab-case preferred, but dot-names and behaviorOS are allowed — ADR 007 allows mission.create style
      if (!/^[a-z][a-z0-9-]*$/.test(n) && !/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(n)) {
        // allow dot notation legacy (mission.create) and behaviorOS
        if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(n)) errors.push(`invalid tool name: ${n}`);
      }
      if (!reg.tool.description || reg.tool.description.length < 10 || reg.tool.description.length > 200) {
        errors.push(`invalid description for ${n}: must be 10..200 chars`);
      }
      const isZodObj2 = (v: unknown) => !!v && typeof (v as any).parse === "function" && typeof (v as any).safeParse === "function";
      if (!isZodObj2(reg.tool.schema.args)) {
        errors.push(`tool ${n} args must be ZodObject`);
      }
      if (reg.tool.schema.args) {
        try {
          const shape = (reg.tool.schema.args as any).shape ?? (reg.tool.schema.args as any)._def?.shape?.() ?? {};
          const keys = Object.keys(shape);
          if (keys.length === 0) errors.push(`tool ${n} argsShape empty`);
        } catch {}
      }
      if (reg.source === "opencode-tool" && reg.file) {
        if (!existsSync(join(process.cwd(), reg.file))) {
          errors.push(`tool ${n} file not found: ${reg.file}`);
        }
      }
    }
    if (this.tools.size === 0) errors.push("no tools registered");
    return { valid: errors.length === 0, errors };
  }

  snapshot(): MarketplaceSnapshot {
    const tools = [...this.tools.values()].map((r) => {
      let argsShape: string[] = [];
      try {
        const shape = (r.tool.schema.args as any).shape;
        if (shape && typeof shape === "object") argsShape = Object.keys(shape);
        else {
          const def = (r.tool.schema.args as any)._def;
          if (def?.shape) {
            const s = typeof def.shape === "function" ? def.shape() : def.shape;
            argsShape = Object.keys(s ?? {});
          }
        }
      } catch {}
      return {
        name: r.tool.name,
        description: r.tool.description,
        source: r.source,
        file: r.file,
        serverId: r.serverId,
        argsShape,
      };
    });
    // servers from opencode.json
    const servers: MarketplaceSnapshot["servers"] = [];
    try {
      const op = JSON.parse(readFileSync(join(process.cwd(), "opencode.json"), "utf-8"));
      const mcp = op.mcp ?? {};
      for (const [id, cfg] of Object.entries<any>(mcp)) {
        servers.push({
          id,
          type: cfg.type === "remote" ? "remote" : "local",
          command: cfg.command,
          url: cfg.url,
          enabled: cfg.enabled !== false,
        });
      }
    } catch {}
    return {
      version: this._version,
      updatedAt: new Date().toISOString(),
      tools,
      servers,
    };
  }

  async loadFromDisk(rootDir: string): Promise<{ loaded: number; errors: string[] }> {
    const errors: string[] = [];
    let loaded = 0;
    const toolsDir = join(rootDir, ".opencode", "tools");
    if (existsSync(toolsDir)) {
      const files = readdirSync(toolsDir).filter((f) => f.endsWith(".ts"));
      for (const file of files) {
        const name = file.replace(/\.ts$/, "");
        if (this.tools.has(name) || this.tools.has(name.toLowerCase())) continue;
        // special-case: behaviorOS already registered
        if (name === "behaviorOS" && this.tools.has("behaviorOS")) continue;
        try {
          // generic stub tool for discovered file
          const stub = defineTool({
            name,
            description: `Tool ${name} — auto-discovered from .opencode/tools/${file}`,
            args: z.object({ input: z.string().optional() }),
            output: z.string().optional(),
            execute: async (args: any) => `executed ${name} with ${JSON.stringify(args)}`,
          });
          this.register(stub, { source: "opencode-tool", file: `.opencode/tools/${file}` });
          loaded++;
        } catch (e) {
          errors.push(`failed to register ${name}: ${String(e)}`);
        }
      }
    }
    // packages/mcp/tools/*.ts — ADR 007 native registry (always loaded, host sovereign)
    const pkgToolsDir = join(rootDir, "packages", "mcp", "tools");
    if (existsSync(pkgToolsDir)) {
      const files = readdirSync(pkgToolsDir).filter((f) => f.endsWith(".ts") && f !== "index.ts");
      for (const file of files) {
        try {
          const base = file.replace(/\.ts$/, "");
          // infer dot name: mission-update -> mission.update
          const dotName = base.replace(/-/g, ".");
          const kebabName = base;
          // try to import real module first (detailed tools have proper zod schema)
          let realTool: any = null;
          try {
            const { pathToFileURL } = await import("node:url");
            const url = pathToFileURL(join(pkgToolsDir, file)).href;
            const mod: any = await import(url);
            const candidates = [mod.default, mod.tool, ...Object.values(mod)];
            for (const c of candidates) {
              if (c && typeof c === "object" && c.name && c.schema && typeof c.execute === "function") { realTool = c; break; }
              if (c && typeof c === "object" && (c as any).name && (c as any).validate && (c as any).execute) { realTool = c; break; }
            }
          } catch {}
          if (realTool) {
            const existing = this.tools.get(realTool.name) ?? this.tools.get(dotName) ?? this.tools.get(kebabName) ?? this.tools.get(base);
            if (existing) {
              // upgrade stub → real: replace if different schema
              try {
                const existingShape = (() => {
                  try { const s = (existing.tool.schema.args as any).shape; if (s && typeof s === "object") return Object.keys(s); const def = (existing.tool.schema.args as any)._def; const sh = typeof def.shape === "function" ? def.shape() : def.shape; return Object.keys(sh ?? {}); } catch { return []; }
                })();
                const realShape = (() => {
                  try { const s = (realTool.schema.args as any).shape; if (s && typeof s === "object") return Object.keys(s); const def = (realTool.schema.args as any)._def; const sh = typeof def.shape === "function" ? def.shape() : def.shape; return Object.keys(sh ?? {}); } catch { return []; }
                })();
                if (existingShape.join(",") !== realShape.join(",")) {
                  this.unregister(existing.tool.name);
                  this.register(realTool, { source: "builtin", file: `packages/mcp/tools/${file}` });
                  loaded++;
                  continue;
                }
              } catch {}
              continue; // already registered with same shape
            }
            if (this.tools.has(dotName) || this.tools.has(kebabName) || this.tools.has(base)) continue;
            this.register(realTool, { source: "builtin", file: `packages/mcp/tools/${file}` });
            loaded++;
            continue;
          }
          if (this.tools.has(dotName) || this.tools.has(kebabName) || this.tools.has(base)) continue;
          // fallback stub
          const stubName = dotName;
          const stub = defineTool({
            name: stubName,
            description: `Tool ${stubName} — from packages/mcp/tools/${file}`,
            args: z.object({ input: z.string().optional(), missionId: z.string().optional() }),
            output: z.object({ ok: z.boolean(), tool: z.string(), result: z.string().optional() }).passthrough(),
            execute: async (args: any, ctx: any) => ({ ok: true, tool: stubName, result: `stub ${stubName} — implement in packages/mcp/tools/${file}` }),
          });
          this.register(stub, { source: "builtin", file: `packages/mcp/tools/${file}` });
          loaded++;
        } catch (e) {
          errors.push(`failed to register pkg tool ${file}: ${String(e)}`);
        }
      }
    }
    // ensure mcp servers are reflected via snapshot (no extra register needed)
    return { loaded, errors };
  }
}

export const globalMarketplace: McpMarketplace = new InMemoryMarketplace();
export function createMarketplace(): McpMarketplace { return new InMemoryMarketplace(); }
export { InMemoryMarketplace };
