# Integration Contracts — behaviorOS `v1.2.0` — OS 100%

> **Regra de Ouro:** Configuração ≠ integração. Só é funcional com evidência observável.

| Integração | Configuração (o que instalar) | Funcional (evidência observável) | Versão | Auto-approve |
|---|---|---|---|---|
| **OpenCode** | `opencode.json` + `.opencode/agents/*.md` (8 agents, mode:primary|subagent) + `permission: allow` (auto) + `mcp.graphify` | `opencode --version 1.18.16` + `opencode debug config` sem erro + `plugin` load `behaviorOS plugin loaded` | v1.1 | `permission: allow` → sem humano |
| **Graphify** | `mcp.graphify: {type:local, command:[python,-m,graphify.serve,graphify-out/graph.json]}` + `opencode.json mcp` | `graphify-out/graph.json` exists 207 nodes, `doctor: functional — 207 nodes` + `query_graph` responde `graphifyStatus()` | **v1.2 REAL** | `functional: true` → auto |
| **LangGraph** | `src/adapters/langgraph.ts` + `@langchain/langgraph 1.4.13` + `MemorySaver` | `StateGraph` 8 nós compiled + `threadId: workspace::project::workflow` tenant guard + `checkpoint` e2e `graph.getState` | v1.3 | `compiled:true` → auto |
| **Evidence** | `behavior-os/runtime/*.json` writes via `evidenceLedger` | `status: COMPLETED` 8/8 `overall 100` + `governance pass` + `evaluator approved` | v1.2 | `ledger.complete()` → auto |
| **DNA** | `dnas/enterprise-governance.yaml` 1 pattern + `packages/dna/resolver` compose | `DNALoader.validate()` + `personas 3` + `governance 5 rules block|escalate` | v1.2 | `dna.validated` → auto |
| **Skill** | `.opencode/skills/behavioros/SKILL.md` `name: behavioros` parity `agentskills.io` | `skill({name:"behavioros"})` loads `SKILL.md` + `progressive disclosure` | v1.2 | `skill allow` → auto |
| **Governance** | `src/core/governance.ts` 4 policies `AND fail-closed` + `dnas/enterprise-governance.yaml` `block|escalate|warn|log` | `govern(high risk without approval) → block` `medium→escalate` `low→warn` + `action` in `evidence` | v1.2 | `requiresApproval:false` → auto, `true` → humano |
| **Pipeline** | `src/workflow/engine.ts` `handoff` + `gated` + `parallelGroups test+security` + `Quality≥80%` | `trace: handoff:discover→planner … review→orchestrator` + `parallelGroups` `Promise.all` + `quality gate` | v1.2 | `gated:false` → auto, `gated:true` → verifica |
| **Mission** | `src/core/mission-engine.ts` `create→start→execute→complete` + `src/core/learning.ts` `record→detect` | `mission demo COMPLETED` + `learning recorded 2` + `checkpoint workspace::project` | v1.2 | `mission.start()` → auto |
| **Plugin** | `.opencode/plugins/behaviorOS.ts` `Plugin from @opencode-ai/plugin` `tool.execute.before` + `session.idle` | `hooks: tool.execute.before, session.idle` + `Gateway block` + `self-evolution wf-evolved-*` | v1.2 | `allow read` + `block edit/bash` → auto read, humano para write high risk |
| **Scaffolder** | `src/cli/init.ts` `npx behavior-os init --preset enterprise-governance` 19 arquivos | `my-sass` host `src/ preserved` `dnas/` `skill` `plugin` `workflows 8 stages` `doctor: PASS` | v1.2 | `init` → auto, sem humano |

**Auto-approve sem humano:** `opencode.json permission: allow` + `governanceForWorkflow requiresApproval:false` + `DNA action: warn|log|pass` → `govern() → allowed:true action:pass|warn` → `evidence` `COMPLETED` sem `ask`.

**Com humano:** `requiresApproval:true` + `action: block|escalate` + `permission: ask` → `govern() → allowed:false` → `throw` → `ask` no TUI.

Nenhuma integração é marcada funcional sem evidência observável em `behavior-os/runtime/*.json` ou `graphify-out/graph.json`.
