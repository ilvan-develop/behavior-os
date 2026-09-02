/** Gateway — ADR 007 — zod validate → governance → tracing → execute → output validate */
import type { Gateway, GatewayInvokeOptions, GatewayInvocation, McpMarketplace, ToolContext } from "../../src/domain/mcp.js";
import { globalMarketplace } from "./marketplace.js";

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export class InMemoryGateway implements Gateway {
  readonly marketplace: McpMarketplace;
  private invocations = new Map<string, GatewayInvocation[]>();

  constructor(marketplace: McpMarketplace = globalMarketplace) {
    this.marketplace = marketplace;
  }

  async invoke<TOutput = unknown>(opts: GatewayInvokeOptions): Promise<TOutput> {
    const id = nanoid();
    const startedAt = new Date().toISOString();
    const inv: GatewayInvocation = {
      id,
      tool: opts.tool,
      args: opts.args,
      context: opts.context,
      startedAt,
      status: "failed",
      traceId: opts.context.traceId,
      spanId: opts.context.spanId,
    };
    const push = (i: GatewayInvocation) => {
      const list = this.invocations.get(i.context.missionId) ?? [];
      list.push(i);
      this.invocations.set(i.context.missionId, list);
    };

    const reg = this.marketplace.get(opts.tool);
    if (!reg) {
      inv.finishedAt = new Date().toISOString();
      inv.error = `Tool not found: ${opts.tool}`;
      inv.status = "failed";
      push(inv);
      throw new Error(inv.error);
    }

    // governance check via packages/gateway (simple) + fallback to allow
    try {
      const { canExecute } = await import("../gateway/gateway.js");
      // map ToolContext stageId → agent: try to extract agent from context? use stageId as agent hint
      // For now use context.stageId as workflow hint and tool as tool
      const agent = (opts.context as any).agent ?? opts.context.stageId ?? "orchestrator";
      const decision = canExecute(opts.tool, agent, opts.context.workflowId);
      if (!decision.allowed) {
        inv.finishedAt = new Date().toISOString();
        inv.status = "blocked";
        inv.blockedBy = (decision as any).reason ?? "governance";
        inv.error = `blocked by governance: ${decision.reason}`;
        push(inv);
        throw new Error(inv.error);
      }
    } catch (e) {
      if ((e as Error).message?.startsWith("blocked by governance")) throw e;
      // ignore gateway load errors
    }

    // zod validate
    let validated: unknown;
    try {
      validated = reg.tool.validate(opts.args);
    } catch (e: any) {
      inv.finishedAt = new Date().toISOString();
      inv.status = "failed";
      inv.error = `validation_failed: ${e.message ?? String(e)}`;
      push(inv);
      throw new Error(inv.error);
    }

    // execute
    let result: unknown;
    try {
      result = await reg.tool.execute(validated as any, opts.context as ToolContext);
    } catch (e: any) {
      inv.finishedAt = new Date().toISOString();
      inv.status = "failed";
      inv.error = e.message ?? String(e);
      push(inv);
      throw e;
    }

    // output validation if schema output defined
    if (reg.tool.schema.output) {
      try {
        (reg.tool.schema.output as any).parse(result);
      } catch (e: any) {
        inv.finishedAt = new Date().toISOString();
        inv.status = "failed";
        inv.error = `output_validation_failed: ${e.message}`;
        push(inv);
        throw new Error(inv.error);
      }
    }

    inv.finishedAt = new Date().toISOString();
    inv.status = "success";
    inv.result = result;
    push(inv);
    return result as TOutput;
  }

  getInvocations(missionId: string): GatewayInvocation[] {
    return [...(this.invocations.get(missionId) ?? [])];
  }

  clearInvocations(missionId?: string): void {
    if (missionId) this.invocations.delete(missionId);
    else this.invocations.clear();
  }
}

export const globalGateway = new InMemoryGateway(globalMarketplace);
export function createGateway(marketplace?: McpMarketplace): Gateway {
  return new InMemoryGateway(marketplace ?? globalMarketplace);
}
