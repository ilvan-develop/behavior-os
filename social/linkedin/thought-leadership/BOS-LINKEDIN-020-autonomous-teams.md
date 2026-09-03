# BOS-LINKEDIN-020 — Autonomous Teams Need Governance, Not Just Orchestration

> Source: BOS-LESSON-120 · Pillars [2,3] · STABLE · Evidence: `src/agents/orchestrator.ts`, `behavior-os/workflows/autonomous.json`

**Hook:** Orquestrar 8 agentes sem governance é escalar o caos.

**Body:**
Autonomous team ≠ 1 agente que faz tudo. É `orchestrator` (primary) → `researcher → planner → architect → implementer → qa+security (parallel) → reviewer → evidence`.

`autonomous.json: {chain: ["development","parallel"], maxMissions, evaluatorRequired}`. Cada handoff auditado em `behavior-os/runtime/*.json`.

Sem governance, `test+security` em `Promise.all` vira corrida. Com BOS, `gated:true` + `evaluator quorum` decide `COMPLETED`.

**CTA:** `school-bos/12-autonomous-teams/README.md` + `pnpm demo:autonomous`

**Hashtags:** #AutonomousAgents #AIGovernance #BehaviorOS

**Visual:** Orchestrator → subagents flow + parallelGroups. Prompt: `../images/prompts/autonomous-team.md`
