# BOS-LESSON-120 — Autonomous AI Teams

> Módulo 12 · STABLE · 1.3.0

## Learning objective

Orquestrar autonomous team: `orchestrator` + `autonomous.json` chain + evaluator quorum.

## Prerequisites

11 MCP

## Concept

Autonomous team = `orchestrator` (mode primary) delega para subagents (planner, architect, implementer, qa, security, reviewer) via `handoff` + `parallelGroups`, com `autonomous: {maxMissions, evaluatorRequired, chain}`. Não é "agente único que faz tudo".

## Why it matters

Teams autônomos sem orquestração determinística divergem; com BOS, cada handoff é auditado em `evidence`.

## BehaviorOS implementation

- `.opencode/agents/orchestrator.md` — mode primary, permission task/edit
- `src/agents/orchestrator.ts` — orchestrator logic
- `behavior-os/workflows/autonomous.json` — `{chain: ["development","parallel"], maxMissions, evaluatorRequired}`
- `behavior-os/workflows/development.json` — pipeline base 8 stages
- `src/workflow/engine.ts` — chain execution
- `scripts/run-autonomous.ts` — `pnpm demo:autonomous`
- `behavior-os/runtime/demo.json:evaluator` — quorum

## Hands-on

```bash
cat behavior-os/workflows/autonomous.json
cat .opencode/agents/orchestrator.md
pnpm demo:autonomous
cat behavior-os/runtime/demo.json | python -c "import json; d=json.load(open('behavior-os/runtime/demo.json')); print(d['evaluator'])"
ls behavior-os/runtime/*.json
```

## OpenCode prompt

```
Leia behavior-os/workflows/autonomous.json e src/agents/orchestrator.ts.
Explique como o orchestrator delega via handoff + parallelGroups e como evaluator quorum decide COMPLETED.
Rode pnpm demo:autonomous e mostre evidence.
```

## Expected result

Explica chain + handoffs + evaluator + evidence `COMPLETED`.

## Verification

```bash
pnpm demo:autonomous && cat behavior-os/runtime/demo.json | grep COMPLETED
pnpm doctor 2>&1 | grep "workflows:"
```

## Common mistakes

- Achar que `autonomous` = 1 agente — são 8 agents + skills.
- `evaluatorRequired: false` → overall pode ser 100 sem gates reais.

## Troubleshooting

Autonomous não chain → `cat behavior-os/workflows/autonomous.json | grep chain` + `scripts/run-autonomous.ts` logs.

## Challenge

Crie team `surgical-team` DNA + `autonomous.json` chain custom `["research","development"]`.

## Completion criteria

Roda `demo:autonomous` e explica orchestrator → subagents com arquivo:linha.
