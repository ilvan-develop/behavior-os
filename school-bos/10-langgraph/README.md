# BOS-LESSON-100 — LangGraph: StateGraph 8 + MemorySaver

> Módulo 10 · STABLE · 1.3.0

## Learning objective

Executar e explicar `StateGraph` durável com checkpointing.

## Prerequisites

09 Graphify

## Concept

LangGraph = runtime durável opcional. `StateGraph` com `State` (missionId, workflowId, completed, current), 8 `nodes` (stages development), `edges` sequenciais, `MemorySaver` checkpoint, `threads`. Prova = `StateGraph` compilado + testado e2e (Regra de Ouro).

Conceitos oficiais ([LangGraph Docs](https://docs.langchain.com/oss/javascript/langgraph/overview)):
State, Nodes, Edges, Graph execution, Persistence, Checkpointing, Threads, Durable execution, Human-in-the-loop, Interrupts, Memory, Resuming, Fault tolerance, Functional API, Graph API.

## Why it matters

Workflows stateful precisam retomar após falha. `MemorySaver` guarda `getState(thread_id)`; `human-in-the-loop` via `interrupt`.

## BehaviorOS implementation

- `src/workflow/langgraph-graph.ts:1-101` — `BehaviorState` Annotation, `makeNode`, `buildBehaviorGraph()` (8 nodes), `buildParallelGraph()` (fan-out), `runBehaviorGraph()`, `runParallelGraph()`
- `src/adapters/langgraph.ts` — `langGraphStatus()` (doctor consome)
- `src/cli/doctor.ts:65-72` — `langgraph: functional — 8 nodes, compiled`
- `package.json:deps` — `@langchain/langgraph ^1.4.13`, `@langchain/core ^1.2.9`
- `behavior-os/runtime/demo.json:langgraph` — `{available, compiled, nodeCount, threadId}`

## Architecture

```ts
// src/workflow/langgraph-graph.ts:28-51
BehaviorState { missionId, workflowId, completed: reducer([...a,...b]), current }
builder.addNode("discover", makeNode("discover")) ... x8
  .addEdge(START,"discover") ... .addEdge("evidence",END)
  .compile({ checkpointer: new MemorySaver() })
  → graph.invoke({missionId, workflowId}, {configurable:{thread_id}})
  → graph.getState({thread_id}) // checkpoint persiste
```

## Hands-on

```bash
cat src/workflow/langgraph-graph.ts
pnpm demo && cat behavior-os/runtime/demo.json | python -c "import json; print(json.load(open('behavior-os/runtime/demo.json'))['langgraph'])"
# Direto:
# npx tsx -e "import {runBehaviorGraph} from './src/workflow/langgraph-graph.ts'; const r=await runBehaviorGraph('m1','development'); console.log(r.result, r.checkpoint)"
```

## OpenCode prompt

```
Leia src/workflow/langgraph-graph.ts e docs langchain LangGraph overview.
Explique State (Annotation), 8 nodes, edges, MemorySaver, thread_id, e como compilar prova integração funcional.
Distinga o que BOS usa hoje vs o que é PLANNED (ex: human-in-loop interrupt).
```

## Expected result

Tabela `Conceito LangGraph → Uso BOS (STABLE/PLANNED)` + código `buildBehaviorGraph`.

## Verification

```bash
pnpm doctor 2>&1 | grep langgraph
cat behavior-os/runtime/demo.json | grep -A5 langgraph
pnpm test 2>&1 | grep -i langgraph
```

## Common mistakes

- Achar que BOS usa `interrupt` human-in-loop hoje — **PLANNED**, não implementado (marcar como tal).
- Confundir `@langchain/langgraph` com `langchain` core — são pacotes distintos.

## Troubleshooting

`langgraph NOT FUNCTIONAL` → `pnpm install` + `pnpm build` + `import {langGraphStatus} from "../adapters/langgraph.js"`.

## Challenge

Implemente `interrupt` antes de `evidence` e teste `graph.getState` → resume.

## Completion criteria

Explica State/Nodes/Edges/MemorySaver/Threads + aponta `buildBehaviorGraph:28-51`.

---

# BOS-LESSON-101 — Parallel Fan-out & Durable Execution

## Learning objective

Entender `buildParallelGraph` fan-out `implement → test+security → review`.

## Prerequisites

BOS-LESSON-100

## BehaviorOS implementation

- `src/workflow/langgraph-graph.ts:54-90` — `buildParallelGraph` (fan-out/fan-in)
- `scripts/run-parallel-demo.ts` — `pnpm demo:parallel`
- `behavior-os/workflows/parallel.json` — `parallelGroups`

## Hands-on

```bash
cat src/workflow/langgraph-graph.ts | grep -A20 buildParallelGraph
pnpm demo:parallel
cat behavior-os/runtime/demo.json | grep -A2 parallel
```

## OpenCode prompt

```
Compare buildBehaviorGraph (sequencial) vs buildParallelGraph (fan-out/fan-in).
Explique durable execution + checkpointing + fault tolerance no BOS.
```

## Completion criteria

Descreve fan-out/fan-in com código e explica durable execution em 2 frases.

## Status labels

- `STABLE`: StateGraph 8 + MemorySaver + parallel fan-out (testado e2e)
- `PLANNED`: human-in-loop interrupts, resuming com `interrupt()`, functional API alternativa
- `EXPERIMENTAL`: LangGraph Platform deploy
