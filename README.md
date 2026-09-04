# behaviorOS

**The Operating System for Governed Autonomous AI Teams**

> Deterministic pipelines · DNA-driven governance · Observable evidence · Fail-closed by design

`behavior-os` is a workflow operating system for multi-agent AI development. It gives AI agent teams **DNA-driven rules, deterministic pipelines, and autonomous orchestration** — with one non-negotiable principle:

> **Configuration is not integration.** Every feature is only "functional" with observable evidence on disk: `behavior-os/runtime/*.json` with `status: COMPLETED`, compiled StateGraphs, and health gates that fail closed.

---

## Table of Contents

- [Why behaviorOS](#why-behavioros)
- [Install](#install)
- [Quickstart — 60 seconds](#quickstart--60-seconds)
- [CLI Reference](#cli-reference)
- [SDK — programmatic usage](#sdk--programmatic-usage)
- [Architecture](#architecture)
- [Governance model](#governance-model)
- [DNA presets](#dna-presets)
- [Workflows](#workflows)
- [Evidence & audit trail](#evidence--audit-trail)
- [Host sovereignty](#host-sovereignty)
- [Security](#security)
- [CI/CD](#cicd)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Why behaviorOS

| Without behaviorOS | With behaviorOS |
|---|---|
| Unpredictable agents | DNA `personas` + deterministic governance `block \| escalate \| warn \| log` |
| No audit trail | `behavior-os/runtime/*.json` `COMPLETED` + hash-chained `audit.log` (sha256) |
| Ad-hoc governance | `govern()` **AND fail-closed** — 4 policies: `default → protected-paths → risk-governance → behavior-level` |
| No learning loop | `LearningEngine` `record → detectPatterns → auto-apply` |
| Non-deterministic pipelines | Declarative workflows with enforced `handoffs`, quality gates (coverage ≥ 80%), `parallelGroups` |
| Human approval fatigue | `opencode.json` per-agent permissions — humans only see `block \| escalate` |
| Protocol as suggestion | **Execution contract**: OpenCode plugin gates every mutating tool — no active mission → escalated to append-only audit journal |

**Verified at time of release:** 440/440 tests · 18 workflows · 12 DNA presets · 45 MCP tools · 1,858-node knowledge graph · W3C-compliant traces · CI green on every push.

---

## Install

```bash
# Use instantly (no install)
npx behavior-os init

# Or install globally
npm i -g behavior-os
behavior-os init
```

**Requirements:** Node.js `>=18`. Optional: Python `>=3.11` (Graphify knowledge layer), an [OpenCode](https://opencode.ai) install for TUI execution.

---

## Quickstart — 60 seconds

In **any existing project** (host sovereignty: your `src/`, `package.json`, `prisma/` stay untouched):

```bash
cd your-project
npx behavior-os init          # scaffolds behavior-os/, dnas/, .opencode/ — only creates missing files

pnpm demo                     # runs the demo mission: Mission → Governance → Workflow → Evidence
cat behavior-os/runtime/demo.json   # → "status": "COMPLETED", coverage 100%
```

Inside the behaviorOS repository itself (contributors):

```bash
git clone https://github.com/ilvan-develop/behavior-os.git
cd behavior-os
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test   # 440/440
pnpm demo                     # Mission → Evidence, COMPLETED
pnpm demo:parallel            # test + security run in parallelGroups (Promise.all)
pnpm demo:autonomous          # autonomous chain: development → parallel
pnpm doctor                   # ~40 health checks → PASS
```

---

## CLI Reference

| Command | Description |
|---|---|
| `npx behavior-os init` | Scaffolds `behavior-os/`, `dnas/`, `.opencode/` into any host project. Never overwrites existing files. |
| `behavior-os status` | Shows Graphify (nodes), LangGraph (compiled), and runtime evidence count. |
| `behavior-os mission create <id>` | Creates `behavior-os/missions/<id>.json` (workflow `development`). |
| `behavior-os mission run <id>` | Validates governance, executes the workflow, writes evidence. |
| `behavior-os mission status <id>` | Prints the evidence file for a mission. |
| `behavior-os evidence [id]` | Lists (or prints) runtime evidence with graphify/langgraph/evaluator stats. |
| `behavior-os verify [id]` | `PASS` iff evidence evaluator approved and coverage is 100%. |
| `behavior-os doctor` | Health gate: ~40 checks (config, agents, evidence, traces, federation). Exit 1 on any failure. |

Repository scripts (contributors): `pnpm test` · `pnpm demo` · `pnpm demo:parallel` · `pnpm demo:autonomous` · `pnpm doctor` · `pnpm build` · `pnpm self-test` · `pnpm audit`.

---

## SDK — programmatic usage

The package ships a hexagonal SDK. **Real exports:** `.`, `./domain`, `./ports`, `./workflow`.

```ts
// ESM — from the published package
import { createSdkPorts } from "behavior-os";
import type { Mission } from "behavior-os/domain";

const ports = createSdkPorts();

// 1. Governance runs first — fail-closed (verdict.allowed = false blocks everything)
const mission = ports.mission.load("behavior-os/missions/demo.json");
const verdict = ports.governance.check(mission);
if (!verdict.allowed) throw new Error(`governance denied: ${verdict.reasons.join("; ")}`);

// 2. Execute the workflow deterministically → evidence is written to disk
const evidence = await ports.mission.execute(
  "behavior-os/missions/demo.json",
  "behavior-os/workflows/development.json"
);

console.log(evidence.status);              // "COMPLETED"
console.log(evidence.evaluator?.approved); // true
console.log(evidence.evaluator?.coverage.overall); // 100
```

Workflow engine port (deterministic stage loop with handoff enforcement and quality gates):

```ts
const workflow = ports.workflow.load("behavior-os/workflows/development.json");
const evidence2 = await ports.workflow.run(workflow, mission);
const all = ports.workflow.list(); // every workflow in behavior-os/workflows/
```

---

## Architecture

```
Mission → Workflow Engine → Agents → Skills → Governance → Evidence
```

```
┌──────────────────────────────────────────────────────────────┐
│                      MISSION LAYER                            │
│   create → start → execute → complete/fail + Learning         │
├──────────────────────────────────────────────────────────────┤
│                      LEARNING LAYER                           │
│   recordLearning → detectPatterns → auto-apply                │
├──────────────────────────────────────────────────────────────┤
│                      QUALITY LAYER                            │
│   Gates: coverage ≥80% · typecheck 0 errors · security stage  │
├──────────────────────────────────────────────────────────────┤
│                      PIPELINE LAYER                           │
│   Deterministic stage loop + enforced handoffs + parallelGroups│
├──────────────────────────────────────────────────────────────┤
│                      GOVERNANCE LAYER                         │
│   block | escalate | warn | log + OPA/Rego + fail-closed AND  │
├──────────────────────────────────────────────────────────────┤
│                    BEHAVIORAL LAYER                           │
│   DNALoader compose: system + project + workflow + agent      │
├──────────────────────────────────────────────────────────────┤
│                      DNA LAYER (YAML)                         │
│   dnas/*.yaml — personas, governance, quality gates, workflows│
└──────────────────────────────────────────────────────────────┘
         ↓ OpenCode (execution) · Graphify (knowledge graph) · LangGraph (durable runtime)
```

**Core guarantees**

- **Deterministic engine** — stages execute in declared order; a wrong handoff throws `handoff violation`; gated stages enforce coverage ≥ 80% (`quality gate failed` otherwise).
- **LangGraph durable runtime** — two compiled `StateGraph`s (sequential 8 nodes + parallel fan-out) with `MemorySaver` checkpoints; the deterministic pipeline remains the source of truth.
- **Observability** — W3C `traceId` (32-hex) / `spanId` (16-hex), parent-chained spans `mission → stage → tool`, persisted to `behavior-os/runtime/traces/<mission>.json`.
- **Knowledge layer** — Graphify graph (`graphify-out/graph.json`) is knowledge, never authority; federation dedups deterministically (`local wins`).

---

## Governance model

Four policies, evaluated in canonical order, **AND fail-closed** (any `block` denies the mission):

| # | Policy | What it enforces |
|---|---|---|
| 1 | `default` | Mission must have `id`, `title`, `workflowId` |
| 2 | `protected-paths` | Blocks missions targeting `prisma/migrations`, `.env`, `node_modules` |
| 3 | `risk-governance` | `risk: high` requires a security-capable workflow (`security-audit`, `incident`, `release`, `migration`) |
| 4 | `behavior-level` | Every workflow has a known level (0–7); level ≥ 5 + high risk requires `governanceApproved` |

Verdicts are appended to a **hash-chained audit log** (`sha256(prevHash + entry)`) — tamper-evident by construction. OPA/Rego integration with deterministic TS fallback (`packages/governance/policy.rego` + `policy.ts`).

**Quality gate:** every `gated` stage must pass coverage thresholds; the `test` stage requires ≥ 80% or the workflow fails with `quality gate failed`.

### Execution contract (OpenCode plugin)

The bundled plugin (`.opencode/plugins/behaviorOS.ts`, installed by `npx behavior-os init`) is **self-contained** — no imports beyond built-ins, so every gate works in any host project:

| Gate | Behavior |
|---|---|
| Protected paths | `.env` read/edit/bash → **blocked unconditionally** |
| Mission guard | `edit/write/bash` with **no active mission** (`IN_PROGRESS` < 24h) → allowed **+ escalated** to append-only audit journal `behavior-os/runtime/gate-journal.jsonl` · mission/verify commands exempt · fresh evidence resets the counter |
| Agent rules | `researcher` is read-only; `security` cannot write → **blocked** |
| Unknown tools | **Blocked** (fail-closed default — never "log and continue") |

With an active mission, mutations run free and produce evidence; without one, nothing is lost — every action is journaled with timestamp, tool, session, and reason. The Discover → Plan → Execute → QA protocol stops being a suggestion and becomes an observable contract.

**Active intelligence (v1.3.3):** the plugin doesn't just gate — it *teaches in real time*. Mutations outside a mission receive a protocol reminder injected into the tool output (the model reads it and corrects course). In idle, the plugin reads the journal + evidence gaps and **proposes the next mission** to `behavior-os/runtime/next-mission-proposal.json` — human-in-the-loop, never auto-executes.

**Autonomous agency (v1.4.0):** recidivism is mechanized — 2 escalations, then the 3rd mutation without a mission is **blocked** until one exists. With the official `selfEvolution` flag enabled (ADR-006 precedence: env > DNA > default false), the system closes the loop itself: proposal → governed mission creation → CLI execution → evidence. Opt-in, fail-closed, and it never edits host code — protocol agency, not magic. **Remediation (v3.8):** mission/verify commands are exempt and fresh evidence resets the counter — recidivism can never deadlock a session.

---

## DNA presets

12 team patterns in `dnas/*.yaml` — personas, governance rules, quality gates, and inline workflow overrides. Drop one into your host project and the whole pipeline adapts:

| Preset | Model | Highlights |
|---|---|---|
| `enterprise-governance` | Compliance/audit/change-mgmt | High risk requires security-audit workflow |
| `regulated-fintech` | SOC2/PCI | Audit-trail gate 100%, hardened protected paths |
| `high-assurance` | Aerospace/medical | Every stage gated, 95% coverage, dual approval |
| `autonomous-swarm` | Level-7 self-optimizing | Evaluator-gate 95%, durable LangGraph |
| `incident-response` | SEV1 fail-fast | Time-boxed, mttr-gate, rollback + post-mortem |
| `scaled-enterprise` | SAFe | behaviorLevel 6, program-increment gate |
| `platform-team` | Infra/SRE | SLI gate 99, protected `infra/terraform|k8s` |
| `open-source` | Community | Maintainer review, CLA/DCO |
| `product-discovery` | Lean | Prototype gate, relaxed coverage |
| `startup-velocity` | Speed | Minimal gates, high risk warns |
| `surgical-team` | Brooks chief-programmer | Narrow slices (max 5 files), 85% coverage |
| `research-lab` | Knowledge-first | Graph freshness gate 90%, docs gate |

---

## Workflows

18 declarative workflows in `behavior-os/workflows/*.json` — from `research` (2 stages, level 2) to `autonomous` (8 stages, level 7, mission chaining):

```
research · architecture · refactor · bugfix · incident · learn · brainstorm ·
feature · development · parallel · migration · security-audit · release ·
evolve · autonomous · wf-LEARN-EXEC · wf-enterprise-rbac · wf-evolution-dna-governance
```

Every workflow declares `stages`, `handoffs` (enforced at runtime), optional `parallelGroups`, and its `behaviorLevel`. The governance layer reads these — no hardcoded orchestration in prompts.

---

## Evidence & audit trail

Every mission run produces `behavior-os/runtime/<missionId>.json`:

```jsonc
{
  "missionId": "demo",
  "status": "COMPLETED",          // observable proof — nothing is "done" without this
  "governance":   { "verdict": "pass", "reasons": ["[default] all checks pass", "..."] },
  "graphify":     { "nodeCount": 1858, "freshness": "fresh" },
  "langgraph":    { "available": true, "compiled": true, "nodeCount": 8 },
  "version":      "2.1.0",        // semver, from control plane
  "controlPlane": { "workflowVersion": "2.1.0", "flags": { "...": "..." } },
  "mcp":          { "toolCount": 45, "valid": true },
  "federation":   { "valid": true, "conflicts": 0 },
  "traces":       { "traceId": "545dad…", "spanCount": 9 },
  "evaluator":    { "approved": true, "coverage": { "overall": 100 } }
}
```

Plus: `traces/<mission>.json` (W3C spans), `audit.log` (hash chain), `mcp.json`, `federated.json`, `self-evolution.tson`. Runtime artifacts are **generated, not committed** — `pnpm demo` recreates all of them in any fresh clone.

---

## Host sovereignty

`npx behavior-os init` installs into any SaaS **without transforming it into behaviorOS**:

- Only creates missing files — never overwrites `src/`, `package.json`, `prisma/`, `apps/`
- Merges `opencode.json` additively (`$schema`, MCP servers, permissions)
- Protected paths are policy-enforced at runtime, not just convention

```bash
mkdir my-saas && cd my-saas
echo '{"name":"my-saas","version":"1.0.0"}' > package.json
mkdir src && echo 'export const app="my-saas"' > src/app.ts
npx behavior-os init
ls src/app.ts        # still there — untouched
```

---

## Security

- **Fail-closed everywhere**: governance denies by default; unknown workflows can no longer bypass `behavior-level` (hardened in v1.3.1; execution contract in v1.3.2; active intelligence in v1.3.3); missing evidence fails the gate.
- **Protected paths** block missions touching `prisma/migrations`, `.env`, `node_modules`.
- **Tamper-evident audit**: sha256 hash chain (`prevHash → hash`), verified by `verifyAuditLog()`.
- **No secrets in code**: MCP keys via `{env:VAR}` interpolation (e.g. `CONTEXT7_API_KEY`), never literals. See `.env.example`.
- **Disclosure**: please report vulnerabilities privately via [GitHub Security Advisories](https://github.com/ilvan-develop/behavior-os/security/advisories/new) — do not open public issues.

---

## CI/CD

GitHub Actions (`.github/workflows/`):

- **`ci.yml`** — every push/PR: `pnpm install → typecheck → test (440/440) → demo → doctor`. Green on every push since v1.3.1.
- **`publish.yml`** — on tag `v*`: typecheck → test → build → `pnpm publish --access public` with `NPM_TOKEN`.

```bash
# release flow
npm version patch   # or minor/major
git push --tags     # triggers publish workflow
```

---

## FAQ

**Is this tied to OpenCode?**
No. OpenCode is an execution surface (agents, skills, plugin). The core (`src/`, `packages/`) is pure TypeScript with a hexagonal SDK — usable headless from Node.

**Does it replace my CI?**
No — it complements it. behaviorOS governs *how agents work*; your CI still gates *what ships*. The bundled workflows produce evidence your CI can assert on (`pnpm doctor` exits 1 on failure).

**Why not just prompts?**
Prompts are not contracts. Workflows here are declarative JSON with runtime-enforced handoffs and governance — reproducible, auditable, and diffable.

**What if Graphify/LangGraph are missing?**
Both degrade gracefully: the deterministic pipeline is the source of truth; knowledge graph and durable runtime enhance it when present. `pnpm doctor` reports their status.

**Windows support?**
Yes — developed and tested on Windows. Line-ending hygiene: use `git config core.autocrlf input` when contributing.

---

## Contributing

```bash
git clone https://github.com/ilvan-develop/behavior-os.git
cd behavior-os
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test   # all gates must stay green
pnpm doctor
```

- **AGENTS.md** is the persistent rulebook read by OpenCode/Claude Code and compatible agents.
- **ADRs** (`docs/adr/`) — propose contract changes via ADR (`Status: Proposed → Accepted`).
- **Evidence rule**: any PR claiming a feature must include `behavior-os/runtime/*.json` with `status: COMPLETED` (Configuration ≠ Integration).
- 95% coverage thresholds enforced on core packages (`vitest.config.ts`).

---

## License

[MIT](./LICENSE) — © 2026 Ilvan Joaquim (Angola · Luanda)

[github.com/ilvan-develop/behavior-os](https://github.com/ilvan-develop/behavior-os) · [npm: behavior-os](https://www.npmjs.com/package/behavior-os) · [linkedin/in/ilvan-joaquim-0b0989195](https://www.linkedin.com/in/ilvan-joaquim-0b0989195/)
