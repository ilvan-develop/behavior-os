# Self-Evolution — Behavior OS a construir-se a si próprio (v3.4-discovery)

> Spec de descoberta (não implementação). Plugin não escreve sem passar por Gateway + Evaluator.

## Gatilhos (descobrir, não agir)

1. **File change** — `file.watcher.updated` para `src/**` ou `behavior-os/dna/**` → `graphifyStatus()` freshness stale → sugere `/graphify --update`
2. **Evaluator fail** — `session.idle` lê `behavior-os/runtime/demo.json:1` se `evaluator.coverage.overall <95` ou `stages pct <100` → `proposeEvolution()` em `packages/dna/evolution.ts:1`
3. **Coverage gap** — `computeCoverage()` em `packages/verification/coverage.ts:1` com `global <95` → sugere novo `skill|workflow`

## Contrato (Event → Planner → WorkflowSpec → Gateway → Evidence)

```
Event{type:workflow.failed, missionId, payload:{evaluator}}
  → Planner.planTeam(objective="evoluir Behavior OS para cobrir gap")
  → WorkflowGenerator.generateWorkflow(missionId, team) → WorkflowSpec efémero
  → Gateway.canExecute(tool, agent, workflowId) — verifica DNA invariants (ex security cannot write)
  → se allow → Evidence (não write direto); se deny → emit approval.requested
```

Plugin só pode emitir `evidence` de descoberta (ex `behavior-os/runtime/self-evolution-discovery.json` com `proposals:[]`), nunca `write` em `src/` sem `evaluator.approved`.

## Prova v3.4-discovery (stub)

`packages/orchestrator/self-evolution.ts` — `discoverSelfEvolution(missionId) → {gaps, proposals}` sem side-effect de escrita. Teste: `tests/self-evolution.test.ts` verifica que `security-audit` sem `graphify` propõe `new-skill:graphify-query` via `proposeEvolution`.

Próximo `v3.4-implement` — plugin chama `self-evolution` em `session.idle` e, se `Gateway.allow`, cria `behavior-os/runtime/self-evolution.json` com `proposals` (ainda não `src/`).
