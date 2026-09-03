# BOS-LESSON-060 — Pipelines: Deterministic Execution

> Módulo 06 · STABLE · 1.3.0

## Learning objective

Definir pipeline determinístico: `stages` + `handoffs` + `gated` + evidência.

## Prerequisites

05 Governance

## Concept

Pipeline = sequência declarativa em `behavior-os/workflows/*.json`. Determinístico = mesma entrada → mesma sequência, handoffs fixos, `gated` stages exigem `pass` antes de avançar. Não colocar orquestração em prompt único (`AGENTS.md:Workflow Declarativo`).

## Why it matters

Pipelines não-determinísticos são irreprodutíveis e não auditáveis.

## BehaviorOS implementation

- `behavior-os/workflows/development.json:1-64` — 8 stages (discover→evidence), `handoff: discover→planner`, `gated: test,security,review,evidence`
- `src/workflow/engine.ts` — execução + `parallelGroups` via `Promise.all`
- `behavior-os/workflows/` — 18 workflows (architecture, autonomous, bugfix, etc.)
- `behavior-os/workflows/parallel.json` — exemplo parallelGroups

## Hands-on

```bash
cat behavior-os/workflows/development.json
ls behavior-os/workflows/*.json | wc -l
cat behavior-os/workflows/parallel.json 2>/dev/null | head -n 40
cat src/workflow/engine.ts | grep -A5 parallelGroups | head
pnpm demo && cat behavior-os/runtime/demo.json | python -c "import json; d=json.load(open('behavior-os/runtime/demo.json')); [print(s['stage'], s['status']) for s in d['stages']]"
```

## OpenCode prompt

```
Leia behavior-os/workflows/development.json e src/workflow/engine.ts.
Explique o que torna o pipeline determinístico (stages, handoffs, gated) e mostre a execução em behavior-os/runtime/demo.json.
```

## Expected result

Explica determinismo + lista stages com agente/skill/gated + prova `demo.json:stages`.

## Verification

```bash
cat behavior-os/runtime/demo.json | grep -E '"stage"|COMPLETED'
pnpm demo:parallel && echo "parallel ok"
```

## Common mistakes

- Handoff key ≠ stage id → stage órfão, engine falha silenciosamente.
- `gated:true` sem quality gate → stage nunca passa.

## Troubleshooting

Pipeline não avança → `cat behavior-os/runtime/demo.json | grep -A2 stages` + `src/workflow/engine.ts` logs.

## Challenge

Crie workflow `my-feature.json` com 4 stages (plan→implement→test→evidence) e handoffs custom.

## Completion criteria

Lista 8 stages com handoffs e explica `gated` com exemplo.

---

# BOS-LESSON-061 — Handoffs & ParallelGroups

## Learning objective

Configurar `handoff` e `parallelGroups` (orchestrator-workers).

## Prerequisites

BOS-LESSON-060

## BehaviorOS implementation

- `behavior-os/workflows/development.json:handoffs`
- `behavior-os/workflows/parallel.json:parallelGroups`
- `src/workflow/engine.ts` — `Promise.all` para grupos
- `src/workflow/langgraph-graph.ts:buildParallelGraph` — fan-out `implement → test+security → review`

## Hands-on

```bash
cat behavior-os/workflows/parallel.json
pnpm demo:parallel
cat behavior-os/runtime/parallel.json 2>/dev/null | head -n 40 || cat behavior-os/runtime/demo.json | head -n 40
```

## OpenCode prompt

```
Compare development (sequencial) vs parallel (test+security Promise.all).
Explique handoffs e parallelGroups com código src/workflow/engine.ts:linha.
```

## Completion criteria

Descreve handoff + parallelGroups e quando usar cada.

---

# BOS-LESSON-062 — Quality Gates

## Learning objective

Configurar `quality` gates (`coverage≥80`, `lint 0`, `typecheck 0`, `security`) e entender `Quality ≥80%`.

## Prerequisites

BOS-LESSON-061

## BehaviorOS implementation

- `dnas/enterprise-governance.yaml:52-62` — 3 gates
- `src/domain/types.ts:Evidence.evaluator.coverage`
- `packages/verification/` — coverage provider

## Hands-on

```bash
cat dnas/enterprise-governance.yaml | grep -A4 quality
pnpm test 2>&1 | tail -n 20
pnpm typecheck 2>&1 | tail
```

## OpenCode prompt

```
Explique quality gates do BOS e como evaluator calcula overall.
Mostre onde cada gate é verificado (arquivo:linha).
```

## Completion criteria

Explica 4 gates + overall com fonte.
