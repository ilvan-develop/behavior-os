# INDEX — BehaviorOS School

> Índice navegável. Cada entrada linka para a lição e sua fonte técnica.

## Core

- [README](./README.md) — visão geral, princípio Mission→Learning
- [CURRICULUM](./CURRICULUM.md) — 16 módulos, 30 lições, trilhas
- [LEARNING-PATH](./LEARNING-PATH.md) — Foundations / Builder / Architect
- [PROGRESS](./PROGRESS.md) — checklist pessoal
- [GLOSSARY](./GLOSSARY.md) — 25 termos
- [FAQ](./FAQ.md)
- [TROUBLESHOOTING](./TROUBLESHOOTING.md)
- [CONTRIBUTING](./CONTRIBUTING.md)

## Módulos

| # | Pasta | Lições | Fonte técnica |
|---|-------|--------|---------------|
| 00 | [00-orientation](./00-orientation/README.md) | Mental Model, Repo Tour | `README.md`, `AGENTS.md` |
| 01 | [01-what-is-bos](./01-what-is-bos/README.md) | Definição, 9 Layers | `README.md:Arquitetura` |
| 02 | [02-installation](./02-installation/README.md) | Host Sovereignty, Presets | `src/cli/init.ts` |
| 03 | [03-first-mission](./03-first-mission/README.md) | Lifecycle, Evidence | `src/domain/types.ts:Mission` |
| 04 | [04-dna](./04-dna/README.md) | YAML, Personas, 12 Patterns | `dnas/*.yaml` |
| 05 | [05-governance](./05-governance/README.md) | block/escalate/warn/log, OPA | `packages/governance/policy.rego` |
| 06 | [06-pipelines](./06-pipelines/README.md) | Determinístico, Handoffs, Parallel | `behavior-os/workflows/development.json` |
| 07 | [07-learning](./07-learning/README.md) | LearningEngine, Self-Evolution | `src/core/learning.ts` |
| 08 | [08-opencode](./08-opencode/README.md) | Agents/Skills/Tools/Plugins | `.opencode/` |
| 09 | [09-graphify](./09-graphify/README.md) | 207 nodes, Federation | `graphify-out/graph.json` |
| 10 | [10-langgraph](./10-langgraph/README.md) | StateGraph 8 + MemorySaver | `src/workflow/langgraph-graph.ts` |
| 11 | [11-mcp](./11-mcp/README.md) | Marketplace 45 tools | `packages/mcp/` |
| 12 | [12-autonomous-teams](./12-autonomous-teams/README.md) | Orchestrator, Autonomous | `src/agents/orchestrator.ts` |
| 13 | [13-production](./13-production/README.md) | Control Plane, OTel W3C | `behavior-os/state/control-plane.json` |
| 14 | [14-troubleshooting](./14-troubleshooting/README.md) | Doctor, Failures | `src/cli/doctor.ts` |
| 15 | [15-capstone](./15-capstone/README.md) | Capstone Project | Integrado |

## Relação com Social

```
BOS-LESSON-XXX → BOS-LINKEDIN-XXX → BOS-WA-XXX → BOS-SLIDE-XXX
      ↓ social/CONTENT-STRATEGY.md + EDITORIAL-CALENDAR.md
```

Veja `../social/INDEX.md` e `../SCHOOL-AND-COMMUNITY.md` (índice raiz).
