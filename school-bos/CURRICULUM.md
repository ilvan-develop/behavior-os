# BehaviorOS School — CURRICULUM

> Currículo canônico. Ajustado ao que **realmente existe** em `behavior-os/` v1.3.0. Itens sem implementação são marcados.

**Versão:** BehaviorOS `1.3.0` · **Status:** STABLE · **Verificado:** 2026-09-03

## Mapa (16 módulos → 30 lições)

| # | Módulo | Lições | Status | Fonte |
|---|--------|--------|--------|-------|
| 00 | Orientation | BOS-00-01 Mental Model, BOS-00-02 Repo Tour | STABLE | `README.md`, `AGENTS.md` |
| 01 | What is BehaviorOS? | BOS-01-01 Definição, BOS-01-02 9 Layers OS | STABLE | `README.md:Arquitetura` |
| 02 | Installation | BOS-02-01 Host Sovereignty, BOS-02-02 Presets | STABLE | `src/cli/init.ts`, `behavior-os/` |
| 03 | First Mission | BOS-03-01 Mission Lifecycle, BOS-03-02 Evidence | STABLE | `src/domain/types.ts`, `src/cli/demo.ts` |
| 04 | DNA | BOS-04-01 DNA YAML, BOS-04-02 Personas & Boundaries, BOS-04-03 12 Patterns | STABLE | `dnas/*.yaml` (12) |
| 05 | Governance | BOS-05-01 block/escalate/warn/log, BOS-05-02 OPA/Rego, BOS-05-03 Fail-Closed | STABLE | `packages/governance/policy.rego` |
| 06 | Pipelines | BOS-06-01 Determinístico, BOS-06-02 Handoffs, BOS-06-03 ParallelGroups, BOS-06-04 Quality Gates | STABLE | `behavior-os/workflows/*.json` (18) |
| 07 | Learning | BOS-07-01 LearningEngine, BOS-07-02 Self-Evolution | STABLE | `src/core/learning.ts`, `wf-evolved-*` |
| 08 | OpenCode | BOS-08-01 Agents/Skills/Tools/Plugins, BOS-08-02 Permissions & Auto-approve | STABLE | `.opencode/` (8 agents, 9 skills) |
| 09 | Graphify | BOS-09-01 Knowledge Graph 1202, BOS-09-02 Federation | STABLE | `graphify-out/graph.json`, `federated.json` |
| 10 | LangGraph | BOS-10-01 StateGraph 8 + MemorySaver, BOS-10-02 Parallel Fan-out | STABLE | `src/workflow/langgraph-graph.ts` |
| 11 | MCP | BOS-11-01 Marketplace 45 tools, BOS-11-02 behaviorOS tool | STABLE | `packages/mcp/`, `behavior-os/runtime/mcp.json` |
| 12 | Autonomous Teams | BOS-12-01 Orchestrator, BOS-12-02 Autonomous Workflow | STABLE | `src/agents/orchestrator.ts`, `autonomous.json` |
| 13 | Production | BOS-13-01 Control Plane & Versioning, BOS-13-02 Observability OTel W3C | STABLE | `behavior-os/state/control-plane.json`, `traces/` |
| 14 | Troubleshooting | BOS-14-01 Doctor Gates, BOS-14-02 Common Failures | STABLE | `src/cli/doctor.ts` |
| 15 | Capstone | BOS-15-01 Build Autonomous AI Dev Team | STABLE | Integra todos os módulos |

## Trilhas

### Track A — BOS Foundations (usuário)
00 → 01 → 02 → 03 → 04 (intro) → 06 (intro) → 14

### Track B — BOS Builder (dev)
00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 13 → 15

### Track C — BOS Architect (avançado)
Completo 00→15 + ADRs (`docs/adr/011`), `ARCHITECTURE.md`, `INTEGRATION-CONTRACTS.md`

## Padrão de cada lição

Título → Learning objective → Prerequisites → Concept → Why it matters → BehaviorOS implementation (arquivo:linha) → Architecture → Hands-on → OpenCode prompt → Expected result → Verification → Common mistakes → Troubleshooting → Challenge → Completion criteria

Identificadores estáveis: `BOS-LESSON-XXX`, `BOS-LINKEDIN-XXX`, `BOS-SLIDE-XXX`, `BOS-WA-XXX`

## Gates do currículo

- [ ] `pnpm typecheck` passa
- [ ] `pnpm test` 55/55
- [ ] `pnpm demo` gera `behavior-os/runtime/demo.json` COMPLETED
- [ ] `pnpm doctor` PASS (AGENTS + .opencode 8 agents/9 skills + graphify 1202 + LangGraph 8 + control-plane + mcp + federated + traces)

## Referências

- `docs/GETTING-STARTED.md` (5min), `docs/ARCHITECTURE.md`, `docs/INTEGRATION-CONTRACTS.md`, `docs/OS-100-REPORT.md`
- Externo: [OpenCode Docs](https://opencode.ai/docs/), [OpenCode School](https://opencode.school/), [LangGraph Docs](https://docs.langchain.com/oss/javascript/langgraph/overview), [Graphify Docs](https://graphify.com/docs)
