# BOS-LESSON-030 — Your First Mission: Lifecycle

> Módulo 03 · STABLE · 1.3.0

## Learning objective

Criar, iniciar e completar uma mission; entender `Mission → Evidence` como Regra de Ouro.

## Prerequisites

02 Installation

## Concept

Mission é a unidade de trabalho: `create → start → execute (workflow stages) → complete/fail → learning`. Prova = `behavior-os/runtime/<mission>.json` com `status: COMPLETED`.

## Why it matters

Sem mission, não há governance, pipeline ou evidence — é o "processo" do OS.

## BehaviorOS implementation

- `src/domain/types.ts:14-21` — `Mission { id, title, goal, workflowId, inputs }`
- `src/index.ts` — `BehaviorOS.createMission/startMission`
- `src/cli/demo.ts` — demo mission `development` → `behavior-os/runtime/demo.json`
- `behavior-os/workflows/development.json` — 8 stages (discover→evidence)
- `src/workflow/engine.ts` — execução determinística + `parallelGroups`

## Architecture

```
createMission({title, workflowId: "development"})
  ↓ startMission(missionId)
  ↓ engine.execute → stages sequenciais + handoffs
  ↓ evidence-ledger → behavior-os/runtime/demo.json (COMPLETED, overall 100)
```

## Hands-on

```bash
pnpm demo
cat behavior-os/runtime/demo.json | python -m json.tool | head -n 50
cat behavior-os/runtime/demo.json | grep -E "status|overall|missionId"
# SDK:
# import { BehaviorOS } from 'behavior-os'
# const bos = new BehaviorOS({ dnaPath: './dnas/enterprise-governance.yaml' })
# const m = await bos.createMission({ title: 'Ship payment v2', type: 'feature' })
```

## OpenCode prompt

```
Execute pnpm demo e explique o lifecycle: create→start→execute→evidence.
Mostre behavior-os/runtime/demo.json (status, stages, evaluator.overall).
Se falhar, rode pnpm doctor e diagnostique.
```

## Expected result

`behavior-os/runtime/demo.json` com `status: "COMPLETED"` e `evaluator.coverage.overall: 100` (ou próximo se gates parciais).

## Verification

```bash
cat behavior-os/runtime/demo.json | grep COMPLETED
pnpm doctor 2>&1 | grep "overall: PASS"
```

## Common mistakes

- Rodar `demo` sem `pnpm build` → `tsc` falhou, `dist/` desatualizado.
- Esperar `COMPLETED` sem `pnpm install` — deps faltando.

## Troubleshooting

`demo.json` ausente → `pnpm demo` verbose; `doctor` hint `behavior-os/runtime evidence`.

## Challenge

Crie mission custom via SDK com `workflowId: "bugfix"` e compare `runtime/*.json`.

## Completion criteria

Gera `demo.json` COMPLETED e explica 4 fases do lifecycle.

---

# BOS-LESSON-031 — Evidence & Evaluator

## Learning objective

Ler `Evidence` e entender `evaluator.coverage` (stages, governance, graphify, langgraph, overall).

## Prerequisites

BOS-LESSON-030

## BehaviorOS implementation

- `src/domain/types.ts:52-86` — `Evidence`, `EvidenceTraces`, `evaluator`
- `src/core/evidence-ledger.ts` — única saída auditável
- `behavior-os/runtime/demo.json` — exemplo real
- `behavior-os/runtime/traces/demo.json` — OTel W3C

## Hands-on

```bash
cat behavior-os/runtime/demo.json | python -c "import json; d=json.load(open('behavior-os/runtime/demo.json')); print(json.dumps(d['evaluator']['coverage'], indent=2))"
ls behavior-os/runtime/traces/
```

## OpenCode prompt

```
Leia src/domain/types.ts (Evidence) e behavior-os/runtime/demo.json.
Explique cada campo de evaluator.coverage e como overall é calculado.
Relacione com a Regra de Ouro.
```

## Completion criteria

Explica 5 coberturas + overall e aponta arquivo:linha.
