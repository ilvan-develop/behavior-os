/** MCP Marketplace contracts — ADR 007 — pure domain, no fs/process. zod types only via type import */
import type { z } from "zod";

export interface ToolSchemaDef {
  name: string;
  description: string;
  args: z.ZodObject<z.ZodRawShape>;
  output?: z.ZodTypeAny;
}

export interface ToolContext {
  missionId: string;
  workflowId: string;
  stageId: string;
  traceId?: string;
  spanId?: string;
  signal?: AbortSignal;
}

export interface Tool<TArgs = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly schema: ToolSchemaDef;
  validate(args: unknown): TArgs;
  execute(args: TArgs, ctx: ToolContext): Promise<TOutput>;
}

export interface ToolRegistration {
  tool: Tool;
  source: "opencode-tool" | "mcp-server" | "builtin";
  file?: string;
  serverId?: string;
  registeredAt: string;
}

export interface MarketplaceSnapshot {
  version: string;
  updatedAt: string;
  tools: Array<{
    name: string;
    description: string;
    source: ToolRegistration["source"];
    file?: string;
    serverId?: string;
    argsShape: string[];
  }>;
  servers: Array<{
    id: string;
    type: "local" | "remote";
    command?: string[];
    url?: string;
    enabled: boolean;
  }>;
}

export interface McpMarketplace {
  register(tool: Tool, meta: Omit<ToolRegistration, "tool" | "registeredAt">): void;
  unregister(name: string): boolean;
  list(): ToolRegistration[];
  get(name: string): ToolRegistration | undefined;
  validate(): { valid: boolean; errors: string[] };
  snapshot(): MarketplaceSnapshot;
  loadFromDisk?(rootDir: string): Promise<{ loaded: number; errors: string[] }>;
}

export interface GatewayInvokeOptions {
  tool: string;
  args: unknown;
  context: ToolContext;
}

export interface GatewayInvocation {
  id: string;
  tool: string;
  args: unknown;
  context: ToolContext;
  startedAt: string;
  finishedAt?: string;
  status: "success" | "failed" | "blocked";
  result?: unknown;
  error?: string;
  blockedBy?: string;
  traceId?: string;
  spanId?: string;
}

export interface Gateway {
  readonly marketplace: McpMarketplace;
  invoke<TOutput = unknown>(opts: GatewayInvokeOptions): Promise<TOutput>;
  getInvocations(missionId: string): GatewayInvocation[];
  clearInvocations(missionId?: string): void;
}

// Canonical zod shape — used by adapter to create BehaviorOsToolDef
// Domain re-exports helper type for defineTool
export type DefineToolDef<TArgs, TOutput> = ToolSchemaDef & {
  execute: (args: TArgs, ctx: ToolContext) => Promise<TOutput>;
};
