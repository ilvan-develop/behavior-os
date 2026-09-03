# behaviorOS — The Operating System for Autonomous AI Teams

> **Produto:** behaviorOS | **Identificador técnico:** `behavior-os` | **Comando:** `npx behavior-os init` | **Soberania do host:** `my-sass/` intacto

**BehaviorOS is a behavioral governance framework that gives AI agent teams DNA-driven rules, deterministic pipelines, and autonomous orchestration. Think of it as an operating system for AI agents — it defines *how* agents think, decide, collaborate, and learn.**

```ts
import { BehaviorOS } from '@ilvan-develop/behavior-os/sdk'

const bos = new BehaviorOS({ dnaPath: './dnas/enterprise-governance.yaml' })
const mission = await bos.createMission({ title: 'Ship payment module v2', type: 'feature', priority: 'high' })
await bos.evaluateGovernance('deploy-production', { agent: 'devops', scope: 'production' })
await bos.startMission(mission.id)
```

---

## Por que behaviorOS?

| Sem behaviorOS | Com behaviorOS |
|---|---|
| Agentes imprevisíveis | DNA `personas` + `governance block|escalate|warn|log` determinístico |
| Sem audit trail | `behavior-os/runtime/*.json` `COMPLETED` + `audit.log` hash chain + `graphify 1858` |
| Governança manual | `govern()` `AND fail-closed` + `OPA/Rego` `high risk → security-audit` |
| Sem aprendizado | `LearningEngine record→detect→auto` + `self-evolution wf-evolved-*` |
| Pipelines não-determinísticos | `Pipeline determinístico` `handoff` + `Quality ≥80%` + `parallelGroups test+security` |
| `opencode` `ask` sempre | `opencode.json * allow` + `plugin` `tool.execute.before` → auto-approve `warn|log`, humano só `block|escalate` |

---

## Quick Demo (30s)

```bash
npx behavior-os init --preset enterprise-governance  # scaffolder 19 arquivos, host preservado
pnpm install
pnpm typecheck && pnpm test        # 411/411
pnpm demo                          # Mission → Evidence → behavior-os/runtime/demo.json COMPLETED
pnpm demo:parallel                 # test+security em parallelGroups Promise.all
pnpm demo:autonomous               # chain development + parallel
pnpm doctor                        # AGENTS.md + .opencode + graphify 1858 + LangGraph 8 → PASS
cat behavior-os/runtime/demo.json | grep COMPLETED
```

**My-sass host fresco (soberania):**
```bash
mkdir my-sass && cd my-sass
echo '{"name":"my-sass","version":"1.0.0"}' > package.json
mkdir src && echo 'export const app="my-sass"' > src/app.ts
npx behavior-os init  # cria behavior-os/ + dnas/ + .opencode sem tocar src/
ls src/app.ts  # ainda existe
```

---

## Arquitetura — 9 Layers OS

```
┌──────────────────────────────────────────────────────────────┐
│                      MISSION LAYER                            │
│   create → start → execute → complete/fail + Learning        │
├──────────────────────────────────────────────────────────────┤
│                      LEARNING LAYER                           │
│   recordLearning → detectPatterns → auto-apply wf-evolved-*  │
├──────────────────────────────────────────────────────────────┤
│                      QUALITY LAYER                            │
│   Gates: coverage ≥80% | lint 0 | typecheck 0 | security     │
├──────────────────────────────────────────────────────────────┤
│                      PIPELINE LAYER                           │
│   Pipeline determinístico handoff + parallelGroups + gated   │
├──────────────────────────────────────────────────────────────┤
│                      GOVERNANCE LAYER                         │
│   block | escalate | warn | log + OPA/Rego + Decision quorum │
├──────────────────────────────────────────────────────────────┤
│                   BEHAVIORAL LAYER                             │
│   DNALoader compose system+project+workflow+agent             │
├──────────────────────────────────────────────────────────────┤
│                    DNA LAYER (YAML)                           │
│   dnas/enterprise-governance.yaml 3 personas 5 governance    │
└──────────────────────────────────────────────────────────────┘
         ↓ OpenCode (execução) + Graphify (conhecimento 1858) + LangGraph (durável 8 + MemorySaver)
```

**12 DNA patterns `dnas/*.yaml` v2.0.0:** `enterprise-governance`, `surgical-team`, `startup-velocity`, `platform-team`, `autonomous-swarm`, `research-lab`, `incident-response`, `open-source`, `regulated-fintech`, `product-discovery`, `high-assurance`, `scaled-enterprise`

**22 engines + 45 MCP tools + Plugin v1 → v2 `Plugin.define`:**
* `GovernanceEngine` `Policy as Code` `OPA` + `audit.log` hash chain
* `Observability` `OTel` `W3C 128-bit traceId` + `behavior-os/runtime/traces/*.json`
* `Control Plane` `versioning` `Semver` + `featureFlags` canário + `evidence.version`
* `MCP Marketplace` `behavior-os-mcp` 45 tools `mission.*, evidence.*, graph.*`
* `SDK` `@ilvan-develop/behavior-os` `BehaviorOS` class `createMission/startMission/recordLearning`

---

## Instalação — pnpm + GitHub

**Requisitos:** `node >=18` `pnpm >=9` `python >=3.11` (para `graphify`)

```bash
# Via npm (publicado)
npm i -g behavior-os
npx behavior-os init

# Via pnpm workspace (dev)
git clone https://github.com/ilvan-develop/behavior-os.git
cd behavior-os
pnpm install --frozen-lockfile
pnpm build
```

**GitHub Actions (`.github/workflows/ci.yml` + `publish.yml`):**
```yaml
on: [push, pull_request, push tags v*]
jobs:
  ci: pnpm install → typecheck → test (411/411) → demo → doctor
  publish: on tag v* → pnpm publish --access public (NPM_TOKEN)
```

**pnpm workspace (`pnpm-workspace.yaml`):**
```yaml
packages: ["packages/*"]
allowBuilds: {esbuild: true}
```

---

## Gates Obrigatórios (Regra de Ouro)

```bash
pnpm install → pnpm typecheck (tsc --noEmit + tsconfig.packages.json) → pnpm test (411/411) → pnpm demo → pnpm demo:parallel → pnpm demo:autonomous → pnpm doctor → pnpm build
```

Falha em qualquer gate bloqueia entrega. `Configuração ≠ integração` — só `graphify-out/graph.json` 1858 + `behavior-os/runtime/*.json` `status:COMPLETED` `overall 100` + `evidence.traces` + `mcp.json` 45 tools + `federated.json` são prova.

---

## Estrutura

```
behavior-os/        # config, workflows (18), missions, runtime (evidence COMPLETED), state/control-plane.json, dnas
src/                # kernel, mission-engine, orchestrator, governance 4 policies AND, evidence-ledger, adapters (opencode, graphify, langgraph), workflow/engine determinístico
packages/           # dna/*, gateway/*, governance/policy.rego, kernel/*, knowledge/federation, mcp/marketplace 45, observability/otel-provider W3C, control-plane/versioning, sdk, verification/coverage
.opencode/          # agents (8, mode:primary|subagent), skills (7+behavioros, SKILL.md + agentskills.io), tools/behaviorOS.ts (filename vira tool), plugins/behaviorOS.ts (v1 tool.execute.before + session.idle), commands, mcp.graphify (local) + context7 (remote)
dnas/               # 12 patterns enterprise-governance.yaml + 11 v2.0.0
governance/         # policies/default.json + policy.rego
docs/               # ARCHITECTURE.md, OS-100-REPORT.md, INTEGRATION-CONTRACTS.md (11 integrações), adr/011, GETTING-STARTED.md 5min
examples/my-sass/   # host fresco local only (gitignore) — 19 arquivos, src preservado, exemplo soberania
```

---

## Docs — boas práticas

* `docs/ARCHITECTURE.md` — modelo operacional + fronteiras `src/domain` vs `src/core` vs `adapters` + `evidence-ledger` única saída
* `docs/OS-100-REPORT.md` — evidências `demo, learn-01..10, brainstorm-evolution` + 22 engines + 45 MCP
* `docs/INTEGRATION-CONTRACTS.md` — 11 integrações + `Auto-approve` `* allow` vs `block|escalate` humano
* `docs/GETTING-STARTED.md` — 5min `Claude Code + Cursor + opencode` + `npx behavior-os init --preset`
* `docs/adr/` — `001-core-boundaries`, `002-evidence-first`, `003-bootstrap-delivery`, `004-policy-as-code`, `005-observability-otel`, `006-control-plane-versioning`, `007-mcp-marketplace`, `008-sdk-ports`, `009-knowledge-federation`, `010-dna-patterns`, `011-plugin-v2-migration`
* `CHANGELOG.md` — `v1.3.1` `Hardening fail-closed + CI vivo` + `v1.3.0` `P1 6 ADRs + 12 DNAs` + `v1.2.0` `OS 100%`

**Padrões de docs:** `adr/` com `Status Proposed | Decisão | Consequências | Gates`, `README` com `Quick Demo` + `Arquitetura` + `Instalação` + `Gates` + `Estrutura`, `INTEGRATION-CONTRACTS` com `Auto-approve` coluna.

---

## Uso — my-sass

```bash
cd examples/my-sass
opencode  # TUI 1.18.16, plugin behaviorOS plugin loaded, * allow → nunca mais ask
# no TUI:
/demo     # Mission → Evidence
# ou headless:
pnpm demo
cat behavior-os/runtime/demo.json | grep COMPLETED
```

---

## Contribuindo

```bash
pnpm install
pnpm dev          # watch
pnpm test         # 411/411
pnpm lint:check   # biome
```

Veja `CONTRIBUTING.md`.

---

## Packages

| Package | Descrição | Versão |
|---|---|---|
| `behavior-os` | OS 22 engines + SDK + CLI | 1.3.1 |
| `@opencode-ai/plugin` | Plugin v1 `tool.execute.before` | 0.12.0 |
| `graphify` | Knowledge 1858 nodes | 1.2 |
| `langgraph` | Durable 8 nodes MemorySaver | 1.4.13 |

## Licença

MIT — veja `LICENSE`.

---

Criado por **Ilvan Joaquim** 🇦🇴 Angola · Luanda — [github.com/ilvan-develop](https://github.com/ilvan-develop) · [behavior-os](https://github.com/ilvan-develop/behavior-os) · [linkedin/in/ilvan-joaquim-0b0989195](https://www.linkedin.com/in/ilvan-joaquim-0b0989195/) · [npm: behavior-os](https://www.npmjs.com/package/behavior-os)
