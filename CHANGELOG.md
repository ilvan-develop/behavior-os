# Changelog — behaviorOS

## v1.3.3 — 2026-09-04 — Active Intelligence (feedback loop + mission proposal + orchestrator reflex)

**O plugin deixa de ser só enforcement (polícia) e passa a ter inteligência ativa (feedback loop que o modelo lê + engine de proposta de missões). O protocolo Discover→Plan→Execute→QA agora é corrigido em tempo real e a evolução do sistema é proposta ao operador — human-in-the-loop, nunca auto-execução.**

### Plugin v3.6 — três hooks ativos
- **`tool.execute.before`** (gates v3.5 mantidos): `.env` e unknown tools **blocked** (fail-closed); mission guard registra no journal
- **`tool.execute.after`** (NOVO — feedback loop): mutação fora de missão → o **output da tool recebe o lembrete do protocolo** ("[behaviorOS] ... abra uma missão: `mission create` + `mission run`"). O modelo **lê** essa correção de rota no resultado — o journal deixa de ser passivo
- **`session.idle`** (REATIVADO, self-contained): lê `gate-journal.jsonl` + evidence gaps (evaluator reprovado) → escreve `behavior-os/runtime/next-mission-proposal.json` com a próxima missão sugerida (título, workflowId bugfix/development, razão, fontes). **Dedup** (não re-propõe igual) · **NUNCA auto-executa** — decisão é do operador
- Prioridade da proposta: evidence gaps (bugfix) > violações de protocolo (development) > healthy (no proposal)

### Orchestrator — reflexo mission-first
- `.opencode/agents/orchestrator.md`: pedido de código ⇒ **missão primeiro** (`mission create` + `mission run`), delegação por workflow, conclusão só com evidence COMPLETED + leitura de `next-mission-proposal.json`

### AGENTS.md — Contrato de Execução documentado
- Nova seção: o que o plugin bloqueia, o que escala, onde o modelo lê o feedback, como o self-evolution propõe

### Infra de testes
- `vitest.config.ts`: `fileParallelism: false` — plugin-guard e plugin-intelligence compartilham o journal físico; serialização elimina corrida (também causa do flaky histórico do autonomous.test)
- `tests/plugin-intelligence.test.ts` — 8 testes novos: 3 hooks expostos, reminder injetado (sem/vigente missão), read-only sem reminder, proposal por journal/gap/healthy, dedup
- Suíte: **429/429** · missão `plugin-active-intelligence` COMPLETED (coverage 100%)

## v1.3.2 — 2026-09-04 — Execution Contract (plugin self-contained + fail-closed + mission guard)

**O protocolo behaviorOS agora é contrato de execução, não convenção. O plugin OpenCode é self-contained (funciona em qualquer host sem `packages/`), todos os gates falham fechados, e toda mutação sem missão vigente é escalada com registro de auditoria append-only.**

### Plugin v3.5 — `.opencode/plugins/behaviorOS.ts`
- **Self-contained**: zero imports de `packages/` — o `npx behavior-os init` copia o plugin para o host e todos os gates funcionam (antes: import externo falhava em host → gates de researcher/security mortos, fail-open disfarçado)
- **Fail-closed real**: ferramenta desconhecida no gate → **block** (antes: "logar e seguir")
- **Protected paths incondicional**: `.env` (read/edit/bash) bloqueado com journal
- **Mission guard (escalate)**: `edit/write/bash` sem missão `IN_PROGRESS` vigente (<24h) → **permite + registra** em `behavior-os/runtime/gate-journal.jsonl` (append-only: ts, tool, sessionID, decisão, motivo) — o protocolo Discover→Plan→Execute→QA vira contrato observável
- **Agent rules embutidas**: `researcher` read-only, `security` cannot-write — bloqueios por papel agora disparam de verdade (antes: o campo `agent` não existe no `tool.execute.before` do OpenCode — API oficial verificada — e os blocks nunca disparavam)
- **API oficial OpenCode consultada**: hook `tool.execute.before(input: {tool, sessionID, callID}, output: {args})` (tipos `@opencode-ai/plugin`)

### Gateway canônico — `packages/gateway/gateway.ts`
- Fonte de verdade das regras por agente (`AGENT_RULES`), API `canExecute` compatível; plugin embute as mesmas regras

### Self-evolution movida para CLI
- `pnpm self-test` agora executa o discovery (antes: hook `session.idle` do OpenCode, fora de controle e governance)

### Testes
- `tests/plugin-guard.test.ts` — 11 testes novos: self-containment (grep por imports), `.env` block, mission guard (sem/vigente/expirada), agent rules, unknown tool fail-closed, journal schema
- Suíte: **421/421** · missão `plugin-execution-contract` COMPLETED (evidence coverage 100%)

## v1.3.1 — 2026-09-04 — Hardening (governança fail-closed + CI vivo + higiene de repo)

**Sessão de hardening: fecha fail-open de governança, ressuscita o CI (10 runs históricos falhos por YAML inválido — 0 steps executados), elimina rotatividade de runtime no git e habilita auto-approve OpenCode. QA: 411/411 testes, doctor PASS, CI verde 6× seguidos.**

### Governance — fail-closed
- `src/domain/policies.ts` + `src/core/governance.ts` — `behaviorLevelPolicy` e `governanceForWorkflow` agora conhecem os 18/18 workflows (antes: 6 workflows caíam em "unknown → allow" — fail-open): `brainstorm:4, evolve:7, learn:4, wf-LEARN-EXEC:4, wf-enterprise-rbac:5, wf-evolution-dna-governance:5`
- `behavior-os/workflows/wf-*.json` — `behaviorLevel` explícito nos 3 JSONs + bump `3.1.0 → 3.1.1`
- `tests/behavior-level.test.ts` — 10 testes novos: todos os workflows conhecidos, high-risk sem approval bloqueado em level ≥ 5, JSON ↔ policy map sincronizados, ordem canônica das 4 políticas

### CI — primeira execução verde da história
- `.github/workflows/ci.yml` — fix YAML: scalar `run:` sem aspas com `: ` no JSON do stub `node -e` quebrava o parse (`Nested mappings are not allowed in compact mappings`) → GitHub criava **0 jobs** e marcava failure em 0s; stub migrado para block scalar `run: |` + steps nomeados
- `publish.yml` validado — já são

### Repo hygiene — runtime mutável fora do git
- `.gitignore` — `behavior-os/runtime/traces/*.json`, `self-evolution.tson`, `state/control-plane.json` agora gerados por `pnpm demo/test` (Regra de Ouro: evidência é produzida, não versionada); `.gitkeep` preserva `traces/`
- `tests/otel-provider.test.ts` — cleanup de traces preserva `.gitkeep` (antes: `rmSync(tracesDir, {recursive:true})` apagava o dir tracked)
- `test-output.txt` gitignored; ruído EOL (LF→CRLF) restaurado em 40 arquivos sem diff de conteúdo
- `packages/self-evolution/` + `src/domain/self-evolution.ts` versionados (código ativo importado por 6 módulos — clone quebraria)

### OpenCode — auto-approve
- `.opencode/agents/orchestrator.md` — `bash: {"*": allow}` (antes `ask` para tudo fora git/pnpm/npm)
- `.opencode/agents/qa.md` — `edit: allow` (antes `ask`)
- Semântica oficial: per-agent override top-level, última regra que casa vence

### Docs
- README/GETTING-STARTED — números reais: testes `411/411` (era 55/55), graphify `1858 nodes` (era 1202), workflows `18` (era 19), badges removidos

## v1.3.0 — 2026-09-02 — P1 Production (6 ADRs + 6 Stubs + 12 DNAs)

**BehaviorOS v1.3.0 fecha P1 como framework de governança produção: 6 ADRs especificam contratos auditáveis, 6 stubs viram implementação produção com evidência observável, 12 DNAs cobrem modelos de equipe de Brooks a SAFe sem alterar Kernel. Regra de Ouro: `Configuração não é integração` — toda feature só é funcional com artefato em disco gateado por `pnpm doctor`.**

### ADRs (6) — P1 Contratos

- **ADR-004 Policy as Code** `docs/adr/004-policy-as-code.md` — `package behavioros.governance` `allow if` + `deny contains msg` Rego + adapter `packages/governance/policy.ts` `GovernancePolicy { id, regoPath, evaluate(input): Promise<Verdict> }` tenta OPA WASM (`opa evaluate`) fallback TS `evaluateAll` fail-closed + `behavior-os/runtime/audit.log` hash chain `sha256(prev+entry)` + `governanceApproved → evidence.governance`
- **ADR-005 Observability OTel** `docs/adr/005-observability-otel.md` — `TracingProvider` W3C 128-bit `TraceId /^[0-9a-f]{32}$/` + `SpanId 16 hex` + `parentSpan` hierarquia `mission root → stage → tool` + `Sampling ratio 1.0 dev parentBased` + `TraceContext inject/extract traceparent` + `EventBus packages/kernel/events.ts` bridge `KernelEvent → SpanEvent` + artefato `behavior-os/runtime/traces/<mission>.json` + `Evidence.traces { traceId, file, spanCount, parentSpanId }`
- **ADR-006 Control Plane Versioning** `docs/adr/006-control-plane-versioning.md` — fix bug crítico `isFeatureEnabled` ternário invertido (`canary` travado + default fail-open → fail-closed `false`) + Semver `SEMVER_RE` + `Versioning { getWorkflowVersion, isValidSemver, bumpVersion, bumpWorkflowVersion, listVersions }` + `FeatureFlags { isEnabled, evaluate, listFlags }` `env > dna.flags > default false` + `Evidence.version + controlPlane.flags` + `behavior-os/state/control-plane.json` `{ version, workflows, flags, lastBump }`
- **ADR-007 MCP Marketplace** `docs/adr/007-mcp-marketplace.md` — `Tool { name, description, schema: ZodObject, validate, execute }` + `McpMarketplace { register, list, validate, snapshot, loadFromDisk }` singleton + `Gateway { invoke, getInvocations }` fluxo `get→governance.check→validate→tracing.startSpan→execute→output.parse→evidence` + `.opencode/tools/*.ts` bridge `tool.schema.* → zod` + `McpMarketplace mcpTools 44` (`mission.create..store.write` + `behaviorOS`) + `behavior-os/runtime/mcp.json` + `Evidence.mcp { toolCount, serverCount, invocations, valid }`
- **ADR-008 SDK Ports** `docs/adr/008-sdk-ports.md` — `SdkPorts { mission, workflow, evidence, learning, governance, kernel }` hexagonal ports + `package.json` publicado `name: "behavior-os"` + `exports { ".", "./domain", "./ports", "./workflow" }` + `imports { "behavior-os": "./dist/src/index.js" }` + `files ["dist/","behavior-os/",".opencode/","dnas/"]` sem `src/` bruto + `packages/sdk/index.ts` reescrito sem `../../src` (`import { createSdkPorts } from "behavior-os"`) + `src/index.ts` barrel `createSdkPorts()` + `grep ../../src packages/` gate `0` + `Evidence.sdk { packageName, version, ports, violatedImports }` + `behavior-os/runtime/sdk.json`
- **ADR-009 Knowledge Federation** `docs/adr/009-knowledge-federation.md` — `Federation { federate, merge, validate, snapshot, readFederated, writeFederated }` + `FederatedGraph { nodes[].provenance, links[].provenance }` + `GraphProvenance { source, path, hash sha256, mtime, freshness, nodeCount }` + merge determinístico dedup `local wins` (soberania host) `Mock Map<id,Node>` + ordenação `id` lexicográfica + `graphify-out/federated.json` `{ version, sources[], stats { totalBeforeDedup, totalAfterDedup, deduped, conflicts }, graph }` + `Evidence.federation { federatedPath, sources, stats, valid, conflicts }`

### Stubs → Produção (6) — Implementação

- **Governance** `packages/governance/policy.rego` + `packages/governance/policy.ts` — `REGO_PATH` + `AUDIT_LOG_PATH` `GENESIS_HASH 64 zeros` + `evaluate(input): Verdict` OPA WASM try + TS fallback `evaluateAll` + `audit.log` append `sha256` fail-closed; `src/domain/policies.ts` mantém `AND blockingPolicy` governante
- **Observability** `packages/observability/tracing.ts` → `packages/observability/otel-provider.ts` `OtelTracingProvider implements TracingProvider` `BasicTracerProvider + BatchSpanProcessor + W3CTraceContextPropagator` + `NoopTracingProvider` `OTEL_SDK_DISABLED=true` + `src/domain/tracing.ts` `TRACE_ID_RE / SPAN_ID_RE / isValid* / assert*` + `packages/kernel/events.ts` `on(listener)` + `emit(traceId/spanId)` bridge `activeSpan.addEvent`
- **Control Plane** `packages/control-plane/versioning.ts` corrigido `getWorkflowVersion` `isValidSemver` `bumpVersion("1.2.3","minor")→"1.3.0"` + `isFeatureEnabled` `env "true"/"false" > dnaFlag > default false` + `packages/control-plane/dna-flags.ts` `getDnaFlag/getAllDnaFlags` yaml `behavior-os/dna/*.yaml` cache `mtime` + `packages/control-plane/store.ts` `readControlPlaneState/writeControlPlaneState/ensureControlPlaneState` → `behavior-os/state/control-plane.json` + `src/domain/versioning.ts` `SEMVER_RE, WorkflowVersion, Versioning, FeatureFlags, ControlPlaneState`
- **MCP** `packages/mcp/marketplace.ts` `InMemoryMarketplace` `register/list/validate/snapshot` + `packages/mcp/gateway.ts` `Gateway.invoke` 8 passos governados + `packages/mcp/tool.ts` `defineTool` + `packages/mcp/loader.ts` `loadFromDisk(".opencode/tools")` glob + `opencode.json mcp` → `servers` + `packages/mcp/store.ts` `writeMcpSnapshot` → `behavior-os/runtime/mcp.json` + `packages/mcp/tools/*.ts` 34 tools (`mission.update..store.write`) todos `defineTool` zod; `src/domain/mcp.ts` contratos puros
- **SDK** `packages/sdk/index.ts` `class BehaviorOS { createMission, startMission, recordLearning, getEvidence }` `constructor(ports: SdkPorts = createSdkPorts())` sem `../../src` + `src/domain/ports.ts` `SdkPorts, MissionPort, WorkflowPort, EvidencePort, LearningPort, GovernancePort, KernelPort` + `src/index.ts` barrel `createSdkPorts` + `package.json` `exports`/`imports`/`publishConfig` NodeNext `rewriteRelativeImportExtensions`
- **Knowledge Federation** `packages/knowledge/federation.ts` `federate(localPath, globalPaths)` + `merge(graphs)` puro dedup `local>global>lex` + `validate` `provenance` obrigatório + `packages/knowledge/store.ts` `federatedPath/hashFile/writeFederated/readFederated` sort `id` determinístico → `graphify-out/federated.json` + `src/domain/federation.ts` `SourceId, GraphProvenance, NodeProvenance, FederatedGraph, MergeStats, FederatedSnapshot, Federation`; `src/adapters/graphify.ts` permanece local `graphifyStatus()` sem conhecer federação; `graphify-out/graph.json` 207 nós continua canônico `functional`

### DNAs (12) — ADR-010 P2 v2.0 `dnas/*.yaml`

`kind: dna | version | id | description | personas[] | governance[] | quality[] | workflows[]` — cada com ≥3 personas, ≥3 governance, ≥3 quality, 1 workflow — `yaml.parse` 12/12 PASS — `doctor` valida `personas/governance/quality/workflows` não vazios:

1. `enterprise-governance` v1.0.0 — compliance base `architect, backend, qa` — legado `init --preset` compat
2. `surgical-team` v2.0.0 — Brooks chief-architect `max_modules 2` `owns architecture`
3. `startup-velocity` v2.0.0 — speed 60% gates parallel `founder orchestrator + fullstack`
4. `platform-team` v2.0.0 — SRE infra `owns infra` multi-tenant
5. `autonomous-swarm` v2.0.0 — Level 7 LangGraph durable evaluator-optimizer
6. `research-lab` v2.0.0 — Graphify-first 207 nós hypothesis-driven
7. `incident-response` v2.0.0 — SEV1 fail-fast parallel `qa+security` rollback
8. `open-source` v2.0.0 — community PR `ask/ask` maintainer
9. `regulated-fintech` v2.0.0 — SOC2/PCI audit 100 protected-paths hardened
10. `product-discovery` v2.0.0 — lean hypothesis prototype gate
11. `high-assurance` v2.0.0 — aerospace 95% coverage `ask` dual approval
12. `scaled-enterprise` v2.0.0 — SAFe `behaviorLevel 6` `parallelGroups` program increment

`scaffolder` `src/cli/init.ts --preset <id>` copia qualquer preset preservando `src/` host sovereignty — `evolution.ts` `wf-evolved-*` efémero quando `evaluator.coverage <95`.

### Changed
- `package.json` `version 1.2.0 → 1.3.0` + `exports`/`imports`/`publishConfig` + `files` sem `src/` + `zod ^3.23.8` + `@vitest/coverage-v8`
- `tsconfig.json` `NodeNext` `rewriteRelativeImportExtensions` `types: ["node"]` + `tsconfig.packages.json` inclui `packages/governance|observability|control-plane|mcp|knowledge`
- `src/domain/types.ts` estendido `Evidence { traces, version, controlPlane, mcp, federation, sdk }` + `Workflow { behaviorLevel, autonomous }` preservado
- `src/workflow/engine.ts` injeta `TracingProvider + Versioning + Federation` via ports (não importa adapters)
- `src/core/evidence-ledger.ts` compõe `evidence.traces + version + controlPlane + mcp + federation + sdk` + `flush()` + `writeTraces/mcp/federated/sdk` únicos escritores; `graphify 207` + `langgraph 8` mantidos
- `src/cli/demo.ts` gera `behavior-os/runtime/demo.json` `COMPLETED` + `traces/demo.json` `spans = stages+1` + `mcp.json` `tools≥1 valid` + `control-plane.json` `workflows` + `federated.json` `≥207` + `sdk.json` `violatedImports:[]` + `audit.log` hash chain
- `src/cli/doctor.ts` verifica `traces W3C regex + parentSpan chain + sampling` + `control-plane.json Semver` + `mcp.json tools≥1 valid` + `federated.json hash + provenance` + `sdk.json packageName behavior-os + exports . /ports` + `dnas/*.yaml` parse + `graphify-out/graph.json 207 fresh`
- `behavior-os/workflows/development.json` `version 2.1.0` + `behavior-os/state/control-plane.json` `{ development: "2.1.0" }`

### Fixed
- `isFeatureEnabled` ternário `|| canary ? false:true` → `if env==="true" return true; if dna then dna else false` fail-closed
- `packages/sdk` `../../src` 14 ocorrências → `0` (`behavior-os`/`behavior-os/domain`/`behavior-os/ports`)
- `packages/knowledge/federation.ts` `local===global` stub → `merge()` determinístico `local wins` dedup+conflicts
- `packages/mcp/marketplace.ts` `behavior-os-mcp` 10 → 44 tools registrados via `defineTool` zod `args Shape`
- `packages/observability` stub `traces por stage` → `TracingProvider` W3C `crypto.randomBytes` nunca `Math.random`

### Evidence
- `behavior-os/runtime/demo.json` `COMPLETED` `overall 100` `version 2.1.0` `traces.exists true` `mcp.toolCount 44` `federation.exists true` `sdk.packageName behavior-os`
- `behavior-os/runtime/traces/demo.json` `traceId 32 hex valid` `spans = stages+1` `parentSpanId chain` `sampling ratio 1.0`
- `behavior-os/state/control-plane.json` `workflows { development:"2.1.0" }` `flags { canary:false default }` `lastBump minor`
- `behavior-os/runtime/mcp.json` `tools 44` `servers [{ graphify local }]` `validation.valid true` `invocations []`
- `graphify-out/federated.json` `sources [{ local 207 fresh }]` `stats.totalAfterDedup ≥207` `valid true` `provenance per node`
- `behavior-os/runtime/sdk.json` `packageName behavior-os` `violatedImports []` `ports 6`
- `behavior-os/runtime/audit.log` `sha256(prev+entry)` genesis `0*64` `policy behavioros.governance`
- `graphify-out/graph.json` `functional` 207 nós `fresh` (mantido)
- `LangGraph StateGraph 8 nós + MemorySaver threadId default::learn-03::learn`
- `dnas/*.yaml` 12/12 parse PASS + `docs/adr/004-010.md` 7 ADRs (6 P1 + DNA)
- `vitest run` + `typecheck` + `build` + `demo` + `doctor` PASS (gates `pnpm install → typecheck → test → demo → doctor`)

### Docs
- `docs/adr/004-policy-as-code.md` + `005-observability-otel.md` (251 linhas) + `006-control-plane-versioning.md` (260) + `007-mcp-marketplace.md` (392) + `008-sdk-ports.md` (395) + `009-knowledge-federation.md` (361) + `010-dna-patterns-p2.md` (40)
- `CHANGELOG.md` v1.3.0 + `package.json` `1.3.0` publicado `behavior-os` `bin behavior-os`

---

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
