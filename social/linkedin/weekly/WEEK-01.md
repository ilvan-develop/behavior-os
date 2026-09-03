# WEEK-01 — Foundation Week

> Source: school-bos 00-03 · Version 1.3.0 · STABLE · 2026-09-03

## SEG — BOS-LINKEDIN-001 — What is BehaviorOS? (9 Layers in 1 diagram)

> Source: BOS-LESSON-010/011 · Pillars [1,4] · Status STABLE
> Evidence: `README.md:64-92` (9 Layers diagram), `src/domain/types.ts:14`

**Hook:** Sem BehaviorOS, agentes são imprevisíveis. Com, são um OS.

**Body:**
BehaviorOS = `Mission → Workflow Engine → Agents → Skills → Governance → Evidence`. Não é prompt, é OS.

9 Layers: Mission, Learning, Quality, Pipeline, Governance, Behavioral, DNA + OpenCode/Graphify/LangGraph. Cada com prova observável (`behavior-os/runtime/*.json COMPLETED`).

Por que importa: sem governance, `deploy-production` sem aprovação. Com BOS, `high risk → block` (dnas/enterprise-governance.yaml:28).

**CTA:** Comece em `school-bos/01-what-is-bos/README.md` → `LEARNING-PATH.md Track A`.

**Hashtags:** #BehaviorOS #AIAgents #AISystems

**Visual:** 9 Layers OS diagram (vertical stack, slate/violet/red). Prompt: `social/images/prompts/architecture-9-layers.md`

**Carousel (3):** 1) Sem/Com table (README:29), 2) 9 Layers diagram, 3) Mission→Evidence flow.

**WhatsApp:** Ver `../../whatsapp/weekly/WEEK-01.md#SEG`

---

## TER — BOS-LINKEDIN-002 — Fail-closed governance in 30s

> Source: BOS-LESSON-050 · Pillars [3] · STABLE
> Evidence: `dnas/enterprise-governance.yaml:28-51`, `packages/governance/policy.rego`

**Hook:** `block | escalate | warn | log` — 4 palavras que salvam seu deploy.

**Body:**
Governance determinística: `block` (high risk, no approval), `escalate` (medium → security), `warn`/`log` (auto-approve via `opencode.json: "*": "allow"` + plugin `tool.execute.before`).

OPA/Rego em `packages/governance/policy.rego`. Fail-closed: dúvida → bloqueia. `AND` evaluation.

**CTA:** `school-bos/05-governance/README.md` + teste `cat behavior-os/runtime/demo.json | grep governance`

**Hashtags:** #AIGovernance #OPA #BehaviorOS

**Visual:** Governance matrix `Condition → Action → Auto-approve?` Prompt: `governance-matrix.md`

---

## QUA — BOS-LINKEDIN-003 — Your first mission in 5 min

> Source: BOS-LESSON-030 · Pillars [11,8] · STABLE
> Evidence: `src/domain/types.ts:Mission`, `pnpm demo → behavior-os/runtime/demo.json COMPLETED`

**Hook:** `pnpm demo` → `COMPLETED` em 30s. Assim começa toda mission.

**Body:**
`createMission({title, workflowId: "development"}) → startMission → engine.execute (8 stages) → evidence-ledger → demo.json COMPLETED, overall 100`.

Tente:
```bash
npx behavior-os init --preset enterprise-governance
pnpm install && pnpm demo && cat behavior-os/runtime/demo.json | grep COMPLETED
```

**CTA:** `school-bos/03-first-mission/README.md` + `pnpm doctor`

**Hashtags:** #Tutorial #BehaviorOS #OpenCode

**Visual:** Terminal `pnpm demo` + `demo.json` snippet. Prompt: `tutorial-terminal.md`

---

## QUI — BOS-LINKEDIN-004 — Your repo as 1202-node knowledge graph

> Source: BOS-LESSON-090 · Pillars [6,4] · STABLE
> Evidence: `graphify-out/graph.json` (1202 nodes, 2030 edges), `graphify-out/GRAPH_REPORT.md`

**Hook:** `grep` é cego. Graphify é navegação.

**Body:**
Graphify transforma repo em knowledge graph: 1202 nodes, 108 communities, `knowledge/federation.ts` hub. MCP `graphify` em `opencode.json` + skill `graphify-query`.

`python -m graphify extract . --code-only` → `graphify-out/graph.json` + `federated.json` (provenance, hash 16 hex).

**CTA:** `school-bos/09-graphify/README.md` → `graphify-query` skill no TUI.

**Hashtags:** #KnowledgeGraph #Graphify #BehaviorOS

**Visual:** Knowledge graph viz (nodes violet, edges). Prompt: `knowledge-graph-viz.md`

---

## SEX — BOS-LINKEDIN-005 — Building in public: OS 100% report

> Source: `docs/OS-100-REPORT.md` · Pillars [15,14] · STABLE
> Evidence: `behavior-os/runtime/demo.json` (22 engines, 45 MCP, 12 DNAs, 18 workflows)

**Hook:** OS 100% não é marketing. É `pnpm doctor: PASS` + `demo: COMPLETED`.

**Body:**
`docs/OS-100-REPORT.md` — evidências `demo, learn-01..10, brainstorm-evolution` + 22 engines + 45 MCP tools + 12 DNAs + 18 workflows.

Regra de Ouro: `Configuração ≠ integração`. Só `COMPLETED` conta.

**CTA:** Leia `docs/OS-100-REPORT.md` + junte-se à comunidade (WhatsApp).

**Hashtags:** #BuildingInPublic #OpenSource #BehaviorOS

**Visual:** OS 100% badge + evidence tree. Prompt: `os100-evidence.md`

---

## Verificação semanal

```bash
pnpm doctor 2>&1 | grep "overall: PASS"
cat behavior-os/runtime/demo.json | grep COMPLETED
```
Todos os 5 posts rastreáveis a `BOS-LESSON-XXX` + `arquivo:linha`.
