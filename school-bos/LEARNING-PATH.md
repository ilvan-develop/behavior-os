# LEARNING-PATH — Trilhas BehaviorOS School

> Escolha sua trilha e siga na ordem. Cada módulo lista pré-requisitos e tempo estimado.

## Como usar

1. Identifique seu perfil abaixo.
2. Siga a trilha na ordem; não pule pré-requisitos.
3. Cada lição tem **Hands-on + OpenCode prompt + Verification**.
4. Marque progresso em `PROGRESS.md`.

---

## Track A — BOS Foundations (Usuário)

**Para quem:** quer usar o BOS sem estender o kernel.
**Tempo:** ~4h

| Ordem | Módulo | Lição | Tempo |
|-------|--------|-------|-------|
| 1 | 00 Orientation | Mental Model + Repo Tour | 20m |
| 2 | 01 What is BOS | Definição + 9 Layers | 25m |
| 3 | 02 Installation | Host Sovereignty + Preset | 30m |
| 4 | 03 First Mission | Lifecycle + Evidence | 40m |
| 5 | 04 DNA (intro) | O que é DNA + 12 patterns overview | 20m |
| 6 | 06 Pipelines (intro) | Determinístico + handoffs | 25m |
| 7 | 14 Troubleshooting | Doctor + falhas comuns | 20m |

**Saída:** consegue `npx behavior-os init`, criar mission, ler `behavior-os/runtime/*.json`.

---

## Track B — BOS Builder (Dev)

**Para quem:** vai estender DNA, workflows, MCP, integrações.
**Tempo:** ~12h

Inclui Track A +:

| Ordem | Módulo | Foco |
|-------|--------|------|
| 8 | 04 DNA completo | YAML, personas, boundaries, 12 patterns |
| 9 | 05 Governance | block/escalate/warn/log + OPA/Rego + fail-closed |
| 10 | 06 Pipelines completo | gated, parallelGroups, quality gates ≥80% |
| 11 | 07 Learning | record→detect→auto + wf-evolved-* |
| 12 | 08 OpenCode | agents/skills/tools/plugins + `* allow` auto-approve |
| 13 | 09 Graphify | graph 207 + `graphify-out/federated.json` |
| 14 | 10 LangGraph | StateGraph 8 + MemorySaver + parallel fan-out |
| 15 | 11 MCP | marketplace 45 tools, `behaviorOS` tool |
| 16 | 13 Production | control-plane versioning, OTel W3C traces |
| 17 | 15 Capstone | projeto integrado |

**Saída:** cria DNA próprio, workflow, testa `pnpm demo:parallel`, integra MCP.

---

## Track C — BOS Architect (Avançado)

**Para quem:** opera teams autônomos em produção, governance empresarial.
**Tempo:** ~20h (B + aprofundamento)

Inclui Track B +:

- `12 Autonomous Teams` — orchestrator, `autonomous.json` chain, evaluator quorum
- `docs/adr/001..011` — decisões arquiteturais
- `docs/ARCHITECTURE.md` — fronteiras `src/domain` vs `src/core` vs `adapters`
- `docs/INTEGRATION-CONTRACTS.md` — 11 integrações + auto-approve matrix
- `docs/OS-100-REPORT.md` — evidências OS 100%
- `docs/SECURITY.md` + `governance/policy.rego` — threat model

**Saída:** projeta DNA enterprise, pipelines paralelos, durable execution com checkpointing, observabilidade W3C.

---

## Dependências (grafo)

```
00 → 01 → 02 → 03 → 04 → 05 → 06 → 07
                    ↓         ↓
                    08 → 09 → 10 → 11 → 12 → 13 → 15
                                    ↘ 14 (paralelo)
```

## Verificação por track

- **A:** `pnpm demo && cat behavior-os/runtime/demo.json | grep COMPLETED`
- **B:** `pnpm typecheck && pnpm test && pnpm demo:parallel && pnpm doctor`
- **C:** anterior + `pnpm demo:autonomous && ls behavior-os/runtime/traces/demo.json && cat graphify-out/federated.json | grep valid`

## Dicas

- Use `pnpm doctor` sempre que algo falhar — ele é a Regra de Ouro automatizada.
- Graphify: `python -m graphify extract . --code-only` → `graphify-out/graph.json` (se ausente, `doctor` avisa).
- LangGraph paralelo requer `src/workflow/langgraph-graph.ts:buildParallelGraph` (já compilado).
