# BOS-LESSON-000 — Orientation: Mental Model

> **Módulo 00 — Orientation** · `STABLE` · BehaviorOS `1.3.0` · Verificado `2026-09-03`

## Learning objective

Entender o princípio `Mission → Workflow Engine → Agents → Skills → Governance → Evidence` e onde cada peça vive no repo.

## Prerequisites

Nenhum. É o ponto de entrada.

## Concept

BehaviorOS não é um framework de prompt. É um **OS comportamental**: define *como* agentes pensam, decidem, colaboram e aprendem. OpenCode executa, Graphify lembra, LangGraph persiste, BehaviorOS governa.

## Why it matters

Sem modelo mental, você trata o BOS como "gerador de boilerplate". Com ele, você opera **missions** que produzem **evidência auditável**.

## BehaviorOS implementation

- `AGENTS.md:10` — `Mission → Workflow Engine → Agents → Skills → Governance → Evidence`
- `README.md:66-90` — 9 Layers OS (diagrama)
- `behavior-os/` — config, workflows, runtime, state (ver `behavior-os/README` implícito)
- `src/domain/types.ts:14-21` — `Mission`, `Workflow`, `Evidence`

## Architecture

```
Mission (intent)
  ↓ Workflow Engine (determinístico, handoffs)
  ↓ Agents (8) + Skills (9) — .opencode/
  ↓ Governance (block|escalate|warn|log) — packages/governance/policy.rego
  ↓ Evidence (COMPLETED) — behavior-os/runtime/*.json
  ↓ Learning (record→detect→auto)
```

## Hands-on

1. `cat README.md | head -n 90`
2. `cat AGENTS.md`
3. `ls behavior-os/workflows/ | head`
4. `ls .opencode/agents/ && ls .opencode/skills/`

## OpenCode prompt

> Paste this prompt into OpenCode

```
Leia AGENTS.md e README.md (seção Arquitetura 9 Layers).
Explique em 5 bullets o fluxo Mission→Evidence e liste onde cada camada vive no repo (arquivo:pasta).
Não invente; cite evidências observáveis (ex: behavior-os/runtime/*.json, graphify-out/graph.json).
```

## Expected result

Explicação curta + tabela `Camada → Arquivo → Prova observável`.

## Verification

```bash
test -f AGENTS.md && echo "AGENTS ok"
test -f README.md && echo "README ok"
ls behavior-os/workflows/development.json
```

## Common mistakes

- Confundir `behavior-os/` (runtime) com `behaviorOS` (produto) — ver `AGENTS.md:Produto`.
- Achar que `.opencode/` é opcional — é superfície nativa (`AGENTS.md:Estrutura Nativa`).

## Troubleshooting

`AGENTS.md` ausente → `git checkout -- AGENTS.md`. `behavior-os/` ausente → `npx behavior-os init` ou `pnpm demo`.

## Challenge

Desenhe à mão o fluxo `Human → AI Team → BehaviorOS (OpenCode/Graphify/LangGraph)` e compare com `docs/ARCHITECTURE.md`.

## Completion criteria

Consegue explicar o fluxo Mission→Evidence e apontar 3 arquivos que provam cada camada.

---

# BOS-LESSON-001 — Orientation: Repository Tour

## Learning objective

Navegar o repo e distinguir `src/domain` vs `src/core` vs `adapters` vs `packages/`.

## Prerequisites

BOS-LESSON-000

## BehaviorOS implementation

- `docs/ARCHITECTURE.md` — fronteiras
- `src/domain/types.ts` — tipos canônicos
- `src/adapters/graphify.ts`, `langgraph.ts`, `opencode.ts`
- `packages/*` — dna, gateway, governance, knowledge/federation, mcp, observability, control-plane, sdk

## Hands-on

```bash
ls src/domain/ src/core/ src/adapters/ src/workflow/
cat docs/ARCHITECTURE.md | head -n 60
cat src/domain/types.ts | head -n 60
```

## OpenCode prompt

```
Faça um tour do repo: liste src/domain, src/core, src/adapters, packages/*, behavior-os/*, dnas/*, .opencode/*.
Para cada, diga 1 responsabilidade e 1 arquivo prova.
Use Graphify se disponível (graphify-out/graph.json).
```

## Completion criteria

Lista 7 áreas com responsabilidade + arquivo prova.
