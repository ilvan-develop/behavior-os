# BehaviorOS Architecture

> Source: BOS-SLIDE-002 · BOS-LESSON-011 · STABLE · 1.3.0 - 1.3.0

## Slide 1: 9 Layers Deep Dive

Each layer 1 file 1 evidence (domain vs core vs adapters vs packages).

*Speaker notes:* Map repo.

## Slide 2: Domain Types

src/domain/types.ts: Mission Workflow Evidence.

*Speaker notes:* Canonical types.

## Slide 3: Pipeline Deterministico

behavior-os/workflows/development.json 8 stages handoffs gated.

*Speaker notes:* Determinism.

## Slide 4: Governance

block escalate warn log + OPA policy.rego + audit.

*Speaker notes:* Fail-closed.

## Slide 5: Evidence Ledger

behavior-os/runtime/*.json COMPLETED evaluator overall.

*Speaker notes:* Audit trail.

## Slide 6: OpenCode Surface

.opencode agents 8 skills 9 tools plugins.

*Speaker notes:* Execution.

## Slide 7: Graphify 207

graph.json 1202 nodes federated provenance.

*Speaker notes:* Knowledge.

## Slide 8: LangGraph 8

StateGraph MemorySaver parallel fan-out.

*Speaker notes:* Durable.

## Slide 9: Control Plane + OTel

control-plane.json Semver traces W3C 32/16 hex.

*Speaker notes:* Production.

## Slide 10: ADRs

adr/001..011 boundaries evidence-first bootstrap.

*Speaker notes:* Decisions.

