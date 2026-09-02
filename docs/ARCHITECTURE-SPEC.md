# Behavior OS — Architecture Specification v2.1 (Frozen)

> Behavior OS is a governed, evidence-driven workflow operating system for agentic software development and automation. It coordinates missions, workflows, agents, skills, tools, knowledge, permissions, verification and state across execution runtimes such as OpenCode and LangGraph, while integrating knowledge providers such as Graphify.

**Nome:** `Behavior OS` (marca) / `behavior-os` (identificador técnico: repo, CLI `npx behavior-os init`, pasta `behavior-os/`, npm `@behavior-os/*`)

## 1. Mapa (4 Planes + DNA transversal)

```
                         BEHAVIOR OS
                              |
              ┌───────────────┴───────────────┐
              │                               │
          KERNEL                          DNA SYSTEM
              │                               │
      ┌───────┼───────┐              ┌────────┼────────┐
      │       │       │              │        │        │
    State  Mission Lifecycle       Identity Principles Invariants
              │                               │
              └───────────────┬───────────────┘
                              ▼
                         ORCHESTRATOR
                              │
                 ┌────────────┼────────────┐
                 │            │            │
              Agents       Skills        Tools
                 │            │            │
                 └────────────┼────────────┘
                              │
                          WORKFLOW
                              │
                   ┌──────────┴──────────┐
                   │                     │
              Verification           Governance
                   │                     │
                   └──────────┬──────────┘
                              ▼
                           EVIDENCE → STATE → MEMORY
                              │
                          EVENT BUS
```

*   **Control Plane:** Mission, Policy, Governance, State, DNA
*   **Execution Plane:** Agents, Tools, Workflows, Runtime (OpenCode, LangGraph)
*   **Knowledge Plane:** Graph (Graphify), Memory, Context, Evidence
*   **Verification Plane:** Tests, Evals, Audit, Cognitive Coverage

DNA é transversal, não está dentro de Kernel: `System DNA → Project DNA → Workflow DNA + Agent DNA → Action`.

## 2. Kernel (não sabe programar)

`packages/kernel/{mission,state,context,identity,policy,permissions,lifecycle,events,errors,contracts,checkpoints,evidence}`

**Responsabilidades:**
*   `Mission`: `{id, objective, project, risk, constraints, acceptanceCriteria, requestedBy}` — objeto fundamental.
*   `State`: `created→discovery→planned→executing→blocked→waiting-human→verifying→completed|failed` persistido em `behavior-os/state/{missions,workflows,agents,checkpoints}`.
*   `Context`: `Mission + ProjectState + Graph + Memory + Stage + PreviousEvidence → AgentContext` (evita repo inteiro).
*   `Identity`: quem executa (agent, human, system).
*   `Policy|Permissions`: `read|edit|bash|task|skill` com `allow|ask|deny` granular (OpenCode primitive).
*   `Lifecycle`: transições com `checkpoints` (LangGraph MemorySaver).
*   `Events`: `mission.created, workflow.started, agent.started, tool.called, artifact.created, test.failed, approval.requested, workflow.completed`.
*   `Evidence`: única prova de `COMPLETED`.

## 3. Workflow Engine (declarativo, não prompt)

`packages/workflow/{engine,definitions,stages,transitions}`

Stage contract:
```
Stage { input, actor, capabilities, constraints, output, acceptance, evidence, next, failure }
```
Workflows: `development, feature, bugfix, refactor, migration, security-audit, incident, release, research, architecture` + `payment-change.workflow` (project cria sem tocar kernel).

## 4. Orchestrator (dispatcher inteligente)

`packages/orchestrator/{scheduler,dispatcher,handoff,delegation,recovery}`

Padrões Anthropic: `sequential, parallel, orchestrator-workers (Promise.all), evaluator-optimizer`. Input: `Mission + State + Workflow + Policies + Knowledge` → decide `quem|quando|contexto|ferramentas|próximo|parar|aprovação|retry`.

## 5. Agent OS (capability-bound)

`packages/agents/{registry,runtime,capabilities,contracts}`

Agentes: `orchestrator, researcher, planner, architect, backend, frontend, mobile, database, devops, qa, security, performance, reviewer, release-manager`. Cada `Agent{identity,role,capabilities,tools,skills,permissions,input|output contract,escalation,evaluation}`. Materializado em `.opencode/agents/*.md` (mode primary|subagent|all).

## 6. Skill vs Tool

*   `Skill = como` (procedimento, ex `nextjs`, `auth-review`) → `SKILL.md` (OpenCode nativo)
*   `Tool = executa` (read, bash, deploy) → `Tool Gateway: Agent→Gateway→Policy→Permission→Tool→Result→Evidence`

## 7. Governance

`packages/governance/{policy,permissions,approvals,risk}`

`read→allow, run tests→allow, modify migrations→ask, modify production→deny, deploy production→human approval`. Complementa `opencode.json permission`, não substitui.

## 8. Knowledge OS

`packages/knowledge/{context,graph,retrieval,memory}` + `Evidence`

*   `Knowledge`: o que existe (`UserService→AuthModule`, via Graphify `graphify-out/graph.json` 207 nodes, provenance `EXTRACTED|INFERRED|AMBIGUOUS`)
*   `Memory`: o que aprendemos (MISSION-120 decisões)
*   `Evidence`: o que prova (`test-result, commit, audit`, provenance)

## 9. State Machine

`behavior-os/state/{missions,workflows,agents,checkpoints,decisions,runtime}`

Transições com `LangGraph` para long-running + human-in-the-loop. Adapter implementa `WorkflowRuntime`, não define identidade.

## 10. Verification + Cognitive Coverage

`packages/verification/{evaluator,tests,evals,coverage}`

`Agent done → Evaluator → Tests → Static analysis → Acceptance → Security → Review → Evidence → Decision`. `Cognitive Coverage: arch90 domain90 deps85 docs85 tests80 gov100 global95` → `Truth Confidence ≥95` antes de `COMPLETED`.

## 11. DNA System (hereditário)

`packages/dna/{core,schema,loader,resolver,validator,inheritance,versioning,registry}` + `behavior-os/dna/{system.dna.yaml,project.dna.yaml,agents/*.dna.yaml,workflows/*.dna.yaml}`

4 DNAs: System (princípios `evidence_driven, governed_execution`), Project (stack, multi_tenant), Agent (invariantes `cannot_approve_own_review`), Workflow (invariantes `discovery_before_implementation, evidence_required`). Resolução: `System+Project+Workflow+Agent → Effective DNA` via `Behavior Runtime`.

Levels 0-7 (Reactive→Self-Optimizing) como `workflow.dna.behaviorLevel`, não nomes de agente.

## 12. Adapters (provider-agnostic)

`packages/adapters/{opencode,graphify,langgraph,model,github,gitlab,linear,postgres}`

`core` define `ExecutionProvider|KnowledgeProvider|ModelProvider|RepositoryProvider|WorkflowRuntime|EvidenceStore`. Hoje `adapters/opencode → .opencode/*`, `adapters/graphify → python -m graphify.serve graphify-out/graph.json`.

## 13. CLI + Doctor + Installer

`packages/cli` + `behavior-os doctor` (BIOS): `Kernel✓ Mission✓ Workflow✓ Governance✓ Evidence✓ OpenCode✓ Graphify✓ LangGraph✓ Agents✓ Skills✓ State✓ Memory✓` + `health 96/100, BLOCKERS 0`.

CLI: `init|doctor|status|mission|workflow|agent|skill|evidence|audit|verify|resume|replay|inspect|upgrade`. `npx behavior-os init` detecta `project|OpenCode|Git|pnpm` e gera `manifest + dna + workflows + permissions + Doctor`.

## 14. Gates

Cada ficheiro pertence a um módulo com `contract + test + runtime|doc`. `pnpm install → typecheck → test (20) → demo → demo:parallel → demo:autonomous → doctor` → `behavior-os/runtime/*.json COMPLETED` + `graphify 207` + `langgraph 8` + `evaluator overall 100`. `graphify-out/graph.json` e `behavior-os/runtime/*.json` são a única prova (configuração ≠ integração).

Este spec congela o mapa antes de escrever mais código. Implementação módulo a módulo via `discover→plan→implement→test→audit→evidence` com o próprio Behavior OS a construir-se.
