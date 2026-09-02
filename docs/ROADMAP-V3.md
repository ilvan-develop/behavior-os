# Roadmap v3.0 — Universal Team Orchestrator

> Behavior OS passa de `workflow → agente fixo` para `mission → team dinâmico` capaz de orquestrar qualquer equipa (3-10 agents, mesmo mobile|devops ainda não existentes) sem mudar Kernel.

## Visão v3.0

```
Mission{objective,risk,acceptanceCriteria}
  → DNA Resolver (System+Project invariants)
  → Knowledge Retrieval (graph 207 + memory + 12 workflows)
  → Capability Planner (escolhe team via capabilities)
  → Governance Gate (invariants antes de cada handoff)
  → Universal Orchestrator (compõe workflow efémero: sequential|parallel|loop)
  → Execution (OpenCode|LangGraph) + Context Engine (por stage)
  → Evidence + Evaluator (global 95) → Memory → DNA Evolution
```

## O que muda vs v2.3

| v2.3 (atual) | v3.0 (alvo) |
|---|---|
| 8 agents fixos em `.opencode/agents` | `Agent{capabilities,tools,skills}` indexado no graph, buscável por `query_graph "who can do mcp?"` |
| `workflow.handoffs` estático | `WorkflowSpec` efémero gerado com `Stage{actor:capability, acceptance, evidence}` validado por DNA |
| `orchestrator.ts` com `if parallelGroups` | `planner.ts: planTeam(mission, availableAgents, knowledge) → team` dinâmico |
| Governance 4 policies estáticas | `risk` inferido do graph (ex `authModule` → high) |

## Prova v3.0-discovery (este sprint)

`packages/orchestrator/planner.ts` — `planTeam("Implementar checkout multi-tenant", availableAgents=[researcher,planner,architect,implementer,qa,security]) → [researcher, architect, security]` com `test: team composition`.

Próximo: `v3.1` — `WorkflowSpec` gerado + `v3.2` — `DNA Evolution` via evaluator.
