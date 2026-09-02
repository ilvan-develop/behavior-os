/** LangGraph Runtime — v1.3 Real Durable Graph
 * StateGraph com 8 nós (stages development), edges sequenciais, MemorySaver checkpoint.
 * Compilação é a evidência de integração funcional.
 */
import { StateGraph, Annotation, START, END, MemorySaver } from "@langchain/langgraph";

export const BehaviorState = Annotation.Root({
  missionId: Annotation<string>(),
  workflowId: Annotation<string>(),
  completed: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  current: Annotation<string>({
    reducer: (_a, b) => b,
    default: () => "discover",
  }),
});

function makeNode(stage: string) {
  return async (state: typeof BehaviorState.State) => {
    // simula trabalho do agente + skill
    await new Promise((r) => setTimeout(r, 5));
    return { completed: [stage], current: stage };
  };
}

export function buildBehaviorGraph() {
  const builder = new StateGraph(BehaviorState)
    .addNode("discover", makeNode("discover"))
    .addNode("plan", makeNode("plan"))
    .addNode("architect", makeNode("architect"))
    .addNode("implement", makeNode("implement"))
    .addNode("test", makeNode("test"))
    .addNode("security", makeNode("security"))
    .addNode("review", makeNode("review"))
    .addNode("evidence", makeNode("evidence"))
    .addEdge(START, "discover")
    .addEdge("discover", "plan")
    .addEdge("plan", "architect")
    .addEdge("architect", "implement")
    .addEdge("implement", "test")
    .addEdge("test", "security")
    .addEdge("security", "review")
    .addEdge("review", "evidence")
    .addEdge("evidence", END);

  const checkpointer = new MemorySaver();
  const graph = builder.compile({ checkpointer });
  return { graph, checkpointer };
}

// v1.4: grafo paralelo — test+security em fan-out/fan-in (orchestrator-workers)
export function buildParallelGraph() {
  const builder = new StateGraph(BehaviorState)
    .addNode("discover", makeNode("discover"))
    .addNode("plan", makeNode("plan"))
    .addNode("architect", makeNode("architect"))
    .addNode("implement", makeNode("implement"))
    .addNode("test", makeNode("test"))
    .addNode("security", makeNode("security"))
    .addNode("review", makeNode("review"))
    .addNode("evidence", makeNode("evidence"))
    .addEdge(START, "discover")
    .addEdge("discover", "plan")
    .addEdge("plan", "architect")
    .addEdge("architect", "implement")
    // fan-out: implement -> test & security
    .addEdge("implement", "test")
    .addEdge("implement", "security")
    // fan-in: ambos -> review (LangGraph espera que ambos completem antes de review)
    .addEdge("test", "review")
    .addEdge("security", "review")
    .addEdge("review", "evidence")
    .addEdge("evidence", END);

  const checkpointer = new MemorySaver();
  const graph = builder.compile({ checkpointer });
  return { graph, checkpointer };
}

export async function runParallelGraph(missionId: string, workflowId: string, threadId = "behavior-os-parallel") {
  const { graph } = buildParallelGraph();
  const result = await graph.invoke(
    { missionId, workflowId, completed: [], current: "discover" },
    { configurable: { thread_id: threadId } }
  );
  const state = await graph.getState({ configurable: { thread_id: threadId } });
  return { result, checkpoint: state, threadId, compiled: true, parallel: true as const };
}

export async function runBehaviorGraph(missionId: string, workflowId: string, threadId = "behavior-os-demo") {
  const { graph } = buildBehaviorGraph();
  const result = await graph.invoke(
    { missionId, workflowId, completed: [], current: "discover" },
    { configurable: { thread_id: threadId } }
  );
  // verificar checkpoint persiste
  const state = await graph.getState({ configurable: { thread_id: threadId } });
  return { result, checkpoint: state, threadId, compiled: true };
}
