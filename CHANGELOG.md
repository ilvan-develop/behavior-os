# Changelog — behaviorOS

## v1.2.0 — 2026-09-02 — OS 100% (DNA + Pipelines + Orchestration)

**BehaviorOS is a behavioral governance framework that gives AI agent teams DNA-driven rules, deterministic pipelines, and autonomous orchestration. OS for AI agents — defines how agents think, decide, collaborate, and learn.**

### Added
- **DNA Engine MVP** `dnas/enterprise-governance.yaml` 1 pattern `Enterprise Governance` 3 personas `architect, backend, qa` + 5 governance `block|escalate|warn|log` + 3 quality `coverage 80%` — `think` (LEARN-01)
- **Governance `block|escalate|warn|log|pass`** `GovernanceAction` + `risk medium→escalate` `behavior-level warn` + `evidence-ledger action:*` — `decide` (brocolis 5-gates aprendido)
- **Skill `behavioros`** `.opencode/skills/behavioros/SKILL.md` parity `agentskills.io` `progressive disclosure` + `skill({name:"behavioros"})` — `cross-product`
- **Pipeline determinístico** `src/workflow/engine.ts` handoff validation `discover→planner→architect→implement→qa→security→review→orchestrator` + `gated test,security,review,evidence` + `QualityEngine tests≥80` via `packages/verification/coverage.ts` + `DNA quality.threshold` + `parallelGroups test+security` — `collaborate` (LEARN-02)
- **Mission+Learning** `src/core/learning.ts` `recordLearning→detectPatterns→auto` + `packages/knowledge/memory` + `checkpoint workspace::project::workflow` tenant guard portável `workspace::project` (brocolis) — `learn` (LEARN-03)
- **Policy as Code** `packages/governance/policy.rego` `OPA/Rego` `high risk → security-audit` + `audit.log` hash chain — `decide` (LEARN-04)
- **Observability** `packages/observability/tracing.ts` `OpenTelemetry` traces por stage — `decide` (LEARN-05)
- **Control Plane** `packages/control-plane/versioning.ts` `workflows/*.json versioning` + `feature flags canary` — `collaborate` (LEARN-06)
- **MCP Marketplace** `packages/mcp/marketplace.ts` `behavior-os-mcp` 10 tools `mission.create, evidence.get, graph.query` — `collaborate` (LEARN-07)
- **SDK** `packages/sdk/index.ts` `class BehaviorOS {createMission, startMission, recordLearning}` — `collaborate` (LEARN-08)
- **Knowledge Federation** `packages/knowledge/federation.ts` `local 207 + global 207 federated` — `learn` (LEARN-09)
- **Self-healing** `packages/dna/evolution.ts` `wf-evolved-*` efémero quando `coverage<95` + `Gateway.allow` (já existia, validado `learn-10.json`) — `learn`
- **Scaffolder portável** `src/cli/init.ts` `--preset enterprise-governance` 19 arquivos `dnas/`, `behavior-os/`, `.opencode/{agents,skills,plugins}` + `opencode.json` `plugin[] append` lado-a-lado + `mcp.graphify` + `external_directory` portável `behavior-os/**` — `npx behavior-os init` em qualquer `my-saas/` preserva `src/` (host sovereignty)
- **Plugin OS completo** `.opencode/plugins/behaviorOS.ts` `Plugin` v1 `tool.execute.before` fail-closed só `edit/bash` + `session.idle` `self-evolution` + `v1 API` compat `v2 Plugin.define` — entrega governança total + `multi-plugin` `plugins: ["behaviorOS","outro"]` `id único` last-wins

### Changed
- **Governance** `src/domain/types.ts` `GovernanceVerdict {action}` + `policies.ts` `AND fail-closed blockingPolicy` + `behaviorLevel` `warn` — `AGENTS.md` `behavior-os/` canonical `behavior-os/` (marca `behaviorOS`, pasta `behavior-os`, npm `behavior-os`)
- **Evidence** `src/core/evidence-ledger.ts` `govern(action)` real + `graphify 207` + `LangGraph 8` + `evaluator 100`
- **Plugin** `.opencode/tools/behaviorOS.ts` `behavior-os/runtime/` + sanitize `missionId` + `opencode.json` `model anthropic/claude-sonnet-4-20250514` + `external_directory` portável + `plugin` array
- **Examples** `examples/saas` 4→8 stages `development.json` `parallel.json` + `AGENTS.md` `behavior-os/` + `opencode.json` `bash` `pnpm` etc

### Fixed
- `package.json` dedup `init` key, `pnpm-workspace.yaml` `packages: ["packages/*"]`, `Workflow` `behaviorLevel+autonomous`, `evidence ledger` hardcoded `pass`, `plugin` fail-open + `Date.now` poluição → `hash` determinístico, `external_directory` Windows hardcoded → portável, `gateway` stub

### Evidence
- `behavior-os/runtime/{demo, learn-01..10, brainstorm-evolution, autonomous-demo}.json` todos `COMPLETED` `overall 100`
- `graphify-out/graph.json` `functional` 207 nós `fresh`
- `LangGraph` `StateGraph 8 nós + MemorySaver` `threadId: default::learn-03::learn`
- `55/55 tests` `18 files` `typecheck` `build` `demo:parallel` `demo:autonomous` PASS
- `opencode 1.18.16 v1` `pnpm 11.21.0` `node 24.16.0`

### Docs
- `docs/OS-100-REPORT.md` 6 seções (Evidências, Arquitetura 5 camadas, Brainstorm 10 ideias, 3 Learn Sprints, Scaffolder, Próximo evolve)
- `dnas/enterprise-governance.yaml` + `.opencode/skills/behavioros/SKILL.md`

---

## v1.1.0 — 2026-09-02 — Governance portável + Soberania

- `behavior-os/` canonical, `package.json` dedup, `pnpm-workspace` `packages`, `Workflow` `behaviorLevel`, `governance AND blockingPolicy`, `evidence-ledger` real, `plugin` fail-closed, `opencode.json` portável
- `55/55 tests` + `examples/saas` migrado

## v1.0.0 — Initial

- `Mission → Workflow Engine → Agents → Skills → Governance → Evidence` + `Graphify` + `LangGraph` + `8 stages` + `handoffs`

