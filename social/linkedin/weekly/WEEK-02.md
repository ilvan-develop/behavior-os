# WEEK-02 — Builder Week

> Source: school-bos 04-08 · Version 1.3.0 · STABLE · 2026-09-03 · Graph 1906 nodes / 2717 edges

## SEG — BOS-LINKEDIN-006 — DNA 12 Patterns in Practice

> Source: BOS-LESSON-040 · Pillars [1,9] · STABLE
> Evidence: `dnas/*.yaml` (12 patterns), `packages/dna/resolver.ts`, `src/core/dna-loader.ts`

**Hook:** 12 DNAs, 1 resolver. Como o BOS escolhe quem você é.

**Body:**
DNA = `personas + governance + quality + workflows` em YAML. `System` (org) + `Project` + `Workflow` + `Agent` → `DNALoader` compose com `merge` determinístico. 12 presets: `enterprise-governance`, `surgical-team`, `research-lab` etc.

`npx behavior-os init --preset surgical-team` já traz `behaviorLevel 5`, `block|escalate|warn|log`, `parallelGroups`.

**CTA:** `school-bos/04-dna/README.md` → crie seu DNA.

**Hashtags:** #BehaviorOS #DNA #AIAgents

**Visual:** DNA YAML + 12 patterns grid. Prompt: `social/images/prompts/architecture-9-layers.md`

**WhatsApp:** Ver `../../whatsapp/weekly/WEEK-02.md#SEG`

---

## TER — BOS-LINKEDIN-007 — OpenCode * allow + Plugin Auto-approve

> Source: BOS-LESSON-080 · Pillars [5] · STABLE
> Evidence: `opencode.json:10-25 permission last-wins`, `.opencode/plugins/behaviorOS.ts:tool.execute.before+session.idle`, `.opencode/tools/behaviorOS.ts`

**Hook:** `* allow` não é permissivo. É governança com auto-approve.

**Body:**
`opencode.json permission` = `last-wins`. `*:allow` + `doom_loop:allow` global, mas `Plugin.define` via `tool.execute.before` chama `canExecute(tool,agent,workflow)` em `packages/gateway/gateway.ts`. `warn|log` → auto-approve, `block|escalate` → humano.

Tools: `tool({action: status|run-demo|doctor|evidence, missionId?})` → `argsShape [action,missionId]` non-empty validado por `packages/mcp/marketplace.ts` + `doctor`.

**CTA:** `school-bos/08-opencode/README.md` + `cat .opencode/plugins/behaviorOS.ts | head -n 30`

**Hashtags:** #OpenCode #Plugins #BehaviorOS

**Visual:** Permission matrix `tool → gateway → block/escalate vs warn/log`. Prompt: `opencode-workflow.md`

---

## QUA — BOS-LINKEDIN-008 — LangGraph StateGraph 8 + MemorySaver

> Source: BOS-LESSON-100 · Pillars [7] · STABLE
> Evidence: `src/workflow/langgraph-graph.ts:buildBehaviorGraph`, `MemorySaver`, `threadId workspace::project::workflow.id`

**Hook:** 8 nodes, 1 checkpoint, retomada sem perder estado.

**Body:**
LangGraph = runtime durável opcional. `StateGraph(BehaviorState).addNode discover→...→evidence (+ parallel fan-out implement→test+security)` + `MemorySaver` + `threadId workspace::project::workflow.id`.

`buildParallelGraph` = fan-out `implement → test+security → review` via `Promise.all`. `getState({configurable:{thread_id}})` prova `state_must_be_persistent`.

**CTA:** `school-bos/10-langgraph/README.md` → `pnpm demo:parallel`

**Hashtags:** #LangGraph #DurableExecution #BehaviorOS

**Visual:** StateGraph 8 nodes + MemorySaver diagram. Prompt: `langgraph-workflow.md`

---

## QUI — BOS-LINKEDIN-009 — MCP Marketplace 45 Tools

> Source: BOS-LESSON-110 · Pillars [9] · STABLE
> Evidence: `packages/mcp/marketplace.ts`, `behavior-os/runtime/mcp.json` (toolCount:45 serverCount:2 valid:true), `InMemoryMarketplace`

**Hook:** 45 tools, 2 servers, 1 contrato `argsShape` non-empty.

**Body:**
MCP = `graphify` local (`python -m graphify.serve graphify-out/graph.json --graph`) + `context7` remote. `InMemoryMarketplace` registra `tool({action,missionId})` com `zod` → `marketplace.ts` valida `argsShape` non-empty fail-closed.

`behaviorOS` tool canônica: `tool({action: status|run-demo|doctor|evidence, missionId?})` — filename vira tool. `doctor` bloqueia se `argsShape:[]`.

**CTA:** `school-bos/11-mcp/README.md` + `cat behavior-os/runtime/mcp.json | python -m json.tool | head -n 40`

**Hashtags:** #MCP #Tools #BehaviorOS

**Visual:** Marketplace 45 tools grid. Prompt: `opencode-workflow.md`

---

## SEX — BOS-LINKEDIN-010 — Capstone Preview: Your Autonomous Team

> Source: BOS-LESSON-150 · Pillars [2,15] · STABLE
> Evidence: `school-bos/15-capstone/README.md`, `behavior-os/workflows/autonomous.json`, `src/agents/orchestrator.ts`

**Hook:** Do zero ao capstone: seu time autônomo em 5 missions.

**Body:**
Capstone integra tudo: `Mission → DNA → Governance → Pipeline → Graphify → LangGraph → MCP → Evidence → Learning`. `autonomous.json` chain `development → parallel` sem humano, `evaluator` quorum `overall 100`.

`pnpm demo:autonomous` gera `behavior-os/runtime/autonomous-demo.json` COMPLETED + `traces/demo.json` 9 spans W3C.

**CTA:** `school-bos/15-capstone/README.md` → comece o capstone.

**Hashtags:** #Capstone #AutonomousTeams #BuildingInPublic

**Visual:** Capstone flow Mission→Evidence. Prompt: `autonomous-team.md`

---

## Verificação semanal

```bash
pnpm doctor 2>&1 | grep "overall: PASS"
cat graphify-out/graph.json | python -c "import json; d=json.load(open('graphify-out/graph.json')); print(len(d['nodes']))" # expect 1906
cat graphify-out/federated.json | grep valid # expect '"valid": true'
```
Todos os 5 posts rastreáveis a `BOS-LESSON-XXX` + `arquivo:linha`.
