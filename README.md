# behaviorOS — Workflow Operating System

> **Produto:** behaviorOS | **Identificador técnico:** `behaviorOS` | **Comando:** `npx behaviorOS init`

behaviorOS transforma qualquer repositório num projeto governado e orquestrado por workflows, sem converter o host no próprio behaviorOS.

## Arquitetura

```
Mission → Workflow Engine → Agent System → Skill System → Governance → Evidence Ledger
                ↓
        OpenCode (execução) + Graphify (conhecimento) + LangGraph (runtime durável)
                ↓
           Verify / Audit → Evidence
```

## Instalação (host soberano)

```bash
npx behaviorOS init
# detecta projeto → cria AGENTS.md, behaviorOS/, .opencode/agents|skills|tools|plugins
# → configura opencode.json → doctor → tests → demo
```

Resultado esperado:
```
✓ behaviorOS installed
✓ Orchestrator configured
✓ 8 agents configured
✓ 7 skills configured
✓ development workflow configured
✓ governance configured
✓ evidence configured
✓ OpenCode integration configured
✓ Graphify integration: available/not installed
✓ LangGraph integration: available/not installed
✓ project health: PASS
```

## Gates

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm demo      # Mission → Evidence → behaviorOS/runtime/*.json
pnpm doctor    # AGENTS.md + .opencode + graphify-out + runtime checks
```

## Estrutura

```
behaviorOS/        # config, workflows, missions, runtime (evidence)
src/                # kernel, mission-engine, orchestrator, governance, evidence-ledger, adapters
.opencode/          # agents, skills, tools, plugins, commands (nativo OpenCode)
governance/         # policies/default.json
docs/               # ARCHITECTURE, RESEARCH, MVP-ACCEPTANCE, INTEGRATION-CONTRACTS, adr/
examples/saas/      # exemplo de host com soberania preservada
```

## Regra de Evidência

Configuração ≠ integração. `graphify-out/graph.json` e `behaviorOS/runtime/*.json` com `status: COMPLETED` são a única prova.

## Docs

- `docs/ARCHITECTURE.md` — modelo operacional e fronteiras
- `docs/RESEARCH.md` — pesquisa OpenCode/Graphify/LangGraph atual
- `docs/INTEGRATION-CONTRACTS.md` — contratos de integração com gates
- `docs/adr/` — decisões arquiteturais
