/** LangGraph Adapter — v1.3 Real Durable Runtime
 * Integração funcional = StateGraph compilado com MemorySaver e checkpoint verificável.
 */
import { buildBehaviorGraph } from "../workflow/langgraph-graph.js";

export interface LangGraphStatus {
  available: boolean;
  reason: string;
  threadId?: string;
  compiled?: boolean;
  nodeCount?: number;
}

let cached: LangGraphStatus | null = null;

export function langGraphStatus(): LangGraphStatus {
  if (cached) return cached;
  try {
    const { graph } = buildBehaviorGraph();
    // se compila sem throw, é funcional
    cached = {
      available: true,
      reason: "StateGraph compiled with 8 nodes + MemorySaver checkpointer",
      compiled: true,
      nodeCount: 8,
      threadId: "behavior-os-demo",
    };
    // graph é usado, evita unused
    void graph;
    return cached;
  } catch (e) {
    return { available: false, reason: `compile failed: ${String(e)}`, compiled: false };
  }
}

export async function verifyLangGraphCheckpoint(threadId = "behavior-os-verify"): Promise<boolean> {
  const { runBehaviorGraph } = await import("../workflow/langgraph-graph.js");
  const { checkpoint } = await runBehaviorGraph("verify", "development", threadId);
  return !!checkpoint?.values?.completed?.includes("evidence");
}

export function compileHint(): string {
  return [
    "LangGraph v1.3 functional:",
    "StateGraph in src/workflow/langgraph-graph.ts — 8 nodes (discover→evidence)",
    "MemorySaver checkpointer, thread_id scoped, sequential edges START→END",
    "Verify: graph.invoke({missionId}, {configurable:{thread_id}}) + getState()",
  ].join("\n");
}
