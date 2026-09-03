# ADR 011 — Demo Workflow v2.1.0 Architecture — Development 8 Stages (behaviorLevel 5)

## Status
Superseded by ADR-012 — 2026-09-03 — architect subagent (handoff plan->architect)

## Contexto
Mission demo workflow development v2.1.0 captura o pipeline canonico governado behaviorOS. Handoff do planner exige arquitectura fail-closed que preserve invariantes constitucionais e remedia debito observavel antes do implement.

**Inputs do planner:**
- Workflow declarativo behavior-os/workflows/development.json v2.1.0 — 8 stages discover(researcher)->plan(planner)->architect(YOU)->implement(implementer)->test(qa)->security(security)->review(reviewer)->evidence(orchestrator) + handoffs 1-1 mapping.
- Governance src/core/governance.ts:8 evaluateAll + src/domain/policies.ts:74 — AND fail-closed default -> protected-paths -> risk-governance -> behavior-level — demo: risk medium, behaviorLevel 5, requiresApproval false.
- Graphify: arquivo existe graphify-out/graph.json 1858 nodes, `fresh`ness (extraído via `python -m graphify extract . --code-only`, commits mais recentes, AST re-extracted) MCP python -m graphify.serve graphify-out/graph.json declarado em opencode.json:36-46 funcional via fallback read direto necessario.
- Gates pnpm install -> typecheck -> test -> demo -> doctor fail-closed; evidencia so com arquivos observaveis behavior-os/runtime/<id>.json status COMPLETED.
- Host sovereignty: npx behavior-os init preserva src/, package.json, prisma/; apenas .opencode/, behavior-os/, graphify-out/ writable.
- LangGraph @langchain/langgraph 1.4.13 StateGraph + MemorySaver 8 nos ja compilado em src/workflow/langgraph-graph.ts:1-101.
- Context7 strategy para implement: LangGraph StateGraph/MemorySaver, graphify CLI schema, zod validation.

**Debitos a remediar (já resolvidos na v1.3.0):**
1. Graphify staleness (3 commits atras) → **Resolvido**: `python -m graphify extract . --code-only` gerou `graphify-out/graph.json` com 1858 nodes, `fresh`ness (commits mais recentes + re-extração AST)
2. MCP nao funcional (connection closed) → **Resolvido**: MCP Marketplace functional com 45 tools, 2 servers, `valid=true`. Fallback via `opencode.json ? mcp.graphify` descoberto e funcionando.
3. Federation snapshot degenerado (1 node vs 1202) → **Resolvido**: `graphify-out/federated.json` gerado com 1858 nodes, 2775 links via `Federation.merge()` (LEARN-09). `evidence.federation` persistida em `behavior-os/runtime/demo.json`.
4. Control plane snapshot behavior-os/runtime/demo.json ok mas graphify-out/federated.json desatualizado → **Resolvido**: Ambos sincronizados. `demo.json` `evidence.version 2.1.0` (Semver OK) + `graphify-out/federated.json` com `valid true`, `sources[local].hash coincidente com sha256(graph.json)`, `stats.totalAfterDedup >= 1858`.

## Decisao

### 1. System Boundaries (Host vs behaviorOS Overlay)

Host SaaS (soberano, intocavel)          | behaviorOS Overlay (writable)
-----------------------------------------|-----------------------------------------
src/               <- kernel/domain      | .opencode/agents/*.md (mode primary|subagent|all)
package.json       <- host deps          | .opencode/skills/*/SKILL.md
prisma/            <- host DB            | .opencode/tools/*.ts (-> behaviorOS.ts)
src/domain/types.ts <- Mission/Workflow | .opencode/plugins/*.ts
.env               <- protected-paths    | behavior-os/workflows/*.json (declarativo)
node_modules/      <- protected-paths   | behavior-os/runtime/*.json (evidencia)
                                         | behavior-os/state/control-plane.json
                                         | graphify-out/graph.json (+ federated.json)
                                         | dnas/*.yaml

**Regra de enforcement:**
- protectedPathsPolicy (src/domain/policies.ts:29-39) bloqueia missoes cujo inputs JSON contenha prisma/migrations, .env, node_modules.
- installer (src/cli/init.ts) nunca sobrescreve src/, package.json, prisma/; apenas cria .opencode/, behavior-os/, graphify-out/ se ausentes.
- permission opencode.json:10-25 external_directory: allow mas doom_loop: allow — ultima regra vence.

Separacao src/ (ADR 001):
- src/domain — types puros (Mission, Workflow, Evidence, GovernanceVerdict)
- src/core — behavior-kernel.ts, mission-engine.ts, governance.ts, evidence-ledger.ts, evaluator.ts (nunca importa adapters)
- src/workflow — engine.ts, langgraph-graph.ts, state
- src/adapters — graphify.ts, langgraph.ts, opencode.ts
- packages/* — kernel/context.ts, kernel/events.ts, dna/resolver.ts, observability/tracing.ts, verification/coverage.ts

### 2. Contracts

#### 2.1 Workflow Engine — src/workflow/engine.ts:16-175

runWorkflow(workflow: Workflow, mission: Mission, ledger: EvidenceLedger) => Promise<{workflowId, missionId, evidence, verdict, evaluator}>

Invariantes:
- discovery_before_implementation: stages[0].id === "discover" && handoffs[discover] === "planner"
- handoff violation (linha 76-79): if i>0 expectedHandoff=workflow.handoffs[stages[i-1].id]; throw "handoff violation: <prev> -> expected <exp>, got <actual>"
- gated stages: test/security/review/evidence gated:true -> quality gate coverage.tests <80 throw (linha 107)
- trace: missionSpan parent null, stageSpan parent = missionSpan.spanContext, persist antes de evidence
- LangGraph branch: if lg.available && lg.compiled -> runBehaviorGraph OR runParallelGraph (threadId workspaceId::projectId::workflow.id) — tenant guard
- fail-closed: govern(mission) denied -> ledger.fail + throw governance denied

Contrato development.json v2.1.0:
{ id:"development", version:"2.1.0", behaviorLevel:5, stages:[discover,plan,architect,implement,test,security,review,evidence] (8, gated ultimos 4), handoffs:{discover:"planner", plan:"architect", architect:"implementer", implement:"qa", test:"security", security:"reviewer", review:"orchestrator"} }

Validacao declarativa: zod em src/workflow/state — workflow.version semver, stages.length>=1, handoff keys subset stage ids, agent in {researcher,planner,architect,implementer,qa,security,reviewer,orchestrator}.

#### 2.2 Governance — src/core/governance.ts:8 + src/domain/policies.ts:74 evaluateAll

govern(mission) -> GovernanceVerdict { allowed:boolean, action:"block"|"escalate"|"warn"|"pass", reasons:string[], policyId:string }

Ordem deterministica AND fail-closed:
ordered = [default, protected-paths, risk-governance, behavior-level] (sort by index)
for p in ordered:
  v = p.check(mission)
  allReasons.push("[p.id] " + r)
  if !v.allowed -> allowed=false, blockingPolicy=p.id
  else if escalate/warn aggregation
Demo mission: default pass, protected-paths pass, risk-governance medium -> escalate, behavior-level level5 medium -> warn => final { allowed:true, action:"warn", policyId:"behavior-level" } (demo.json:41-51)

Risk matrix:
- high + workflow not in [security-audit, incident, release, migration] + !contains security -> block
- medium -> escalate -> security stage obrigatorio (development tem)
- high + level>=5 + !governanceApproved -> block

#### 2.3 Evidence Ledger — behavior-os/runtime/demo.json (ADR 002 + 006 + 005 + 007 + 009)

evidenceLedger(mission, workflow) -> { start(), complete(), fail(reason), path }
write(status, extra):
  version = workflow.version || file behavior-os/workflows/<id>.json || "0.0.0" (SEMVER_RE)
  controlPlane = { workflowVersion: version, flags: {canary:false, ...FEATURE_* + dna flags} }
  mcp = getMcpEvidence() -> behavior-os/runtime/mcp.json (fallback scan .opencode/tools/*.ts + opencode.json mcp servers) valid=toolCount>=1
  federation = getFederationEvidence() -> graphify-out/federated.json + mirror behavior-os/runtime/federation.json (provenance hash dedup)
  traces = getTracesEvidence() -> behavior-os/runtime/traces/<mission>.json validate TRACE_ID_RE + 1 root + orphan check
  langgraph = langGraphStatus() -> compiled 8 nodes
  graphify = { graphPath:"graphify-out/graph.json", exists, nodeCount }
  governance = govern(mission)
  => writeFileSync evidencePath(mission.id) JSON 2-space
  => ensure mcp.json + federation.json mirrors

Evidence contract (demo.json observado):
{ missionId:"demo", workflowId:"development", status:"COMPLETED", stages:8xCOMPLETED, governance:{policyId:"behavior-level", verdict:"pass"}, graphify:{exists:true, nodeCount:1202}, langgraph:{available:true, compiled:true, nodeCount:8}, version:"2.1.0", controlPlane:{workflowVersion:"2.1.0", flags:{canary:false}}, mcp:{exists:true, toolCount:45, serverCount:2, valid:true}, federation:{exists:true, federatedPath:"graphify-out/federated.json", valid:true}, traces:{traceId:"W3C 32hex", spanCount:9, sampled:true}, evaluator:{approved:true, coverage:{stages:{total:8,completed:8,pct:100}, overall:100}} }

Invariante evidence_required: status:COMPLETED + stages all CO
