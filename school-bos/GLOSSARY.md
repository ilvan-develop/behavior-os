# GLOSSARY — BehaviorOS

| Termo | Definição | Fonte |
|-------|-----------|-------|
| **BehaviorOS / BOS** | OS comportamental para teams de agentes autônomos: DNA + Governance + Pipelines + Evidence | `README.md:1` |
| **Mission** | Unidade de trabalho: `create → start → execute → complete/fail` + Learning | `src/domain/types.ts:Mission` |
| **DNA** | YAML que define personas, governance, quality, workflows | `dnas/*.yaml`, `src/core/dna-loader.ts` |
| **Persona** | Papel (architect, backend, qa...) com authority, boundaries, skills, permission | `dnas/enterprise-governance.yaml:personas` |
| **Governance** | Regras `block|escalate|warn|log` + OPA/Rego, fail-closed, quorum | `packages/governance/policy.rego` |
| **Pipeline** | Sequência determinística de stages com handoffs e `parallelGroups` | `behavior-os/workflows/development.json` |
| **Handoff** | Delegação `stage → agente` (ex: `discover → planner`) | `workflows.*.handoffs` |
| **Evidence** | `behavior-os/runtime/*.json` com `status: COMPLETED`, coverage, governance, graphify, traces | `src/domain/types.ts:Evidence` |
| **Quality Gate** | Barreira `coverage ≥80%`, lint 0, typecheck 0, security | `dnas/*.yaml:quality` |
| **LearningEngine** | `record→detect→auto-apply wf-evolved-*` | `src/core/learning.ts` |
| **Self-Evolution** | Workflows gerados `wf-evolution-*`, `wf-LEARN-EXEC` | `behavior-os/workflows/wf-evolution-*` |
| **OpenCode** | Superfície de execução: agents, skills, tools, plugins, MCP | `.opencode/` |
| **Graphify** | Knowledge graph `graphify-out/graph.json` (207 nodes), federated | `graphify-out/` |
| **LangGraph** | Runtime durável: `StateGraph` 8 nodes + `MemorySaver` checkpoint | `src/workflow/langgraph-graph.ts` |
| **MCP** | Marketplace 45 tools, `behaviorOS` tool | `packages/mcp/`, `behavior-os/runtime/mcp.json` |
| **Control Plane** | `behavior-os/state/control-plane.json` versioning + featureFlags | `packages/control-plane/` |
| **OTel / W3C Trace** | `behavior-os/runtime/traces/*.json` traceId 32hex, spanId 16hex | `packages/observability/` |
| **Doctor** | Health gate: AGENTS + .opencode + graphify + LangGraph + control-plane + mcp + federated + traces | `src/cli/doctor.ts` |
| **Regra de Ouro** | Configuração ≠ integração; só evidência observável conta | `AGENTS.md` |
| **Soberania do Host** | `npx behavior-os init` preserva `src/`, `package.json`, `prisma/` | `src/cli/init.ts` |
| **ParallelGroups** | `Promise.all` para stages (ex: `test+security`) | `src/workflow/engine.ts` |
| **Autonomous** | Chain `development → parallel`, evaluator quorum | `behavior-os/workflows/autonomous.json` |
