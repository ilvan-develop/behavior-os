# BOS-LESSON-130 — Production: Control Plane & Observability

> Módulo 13 · STABLE · 1.3.0

## Learning objective

Operar control plane versioning + OTel W3C tracing em produção.

## Prerequisites

12 Autonomous Teams

## Concept

Control Plane = `behavior-os/state/control-plane.json` com `version` Semver + `workflows` + `flags` (featureFlags canário). Evidência = `evidence.version` + `evidence.controlPlane` snapshot por mission. Tracing = OTel `W3C 128-bit traceId` (32 hex) + `spanId` 16 hex, `behavior-os/runtime/traces/*.json`, `evidence.traces` correlaciona.

## Why it matters

Sem versioning, rollback é adivinhação. Sem tracing, debugging distribuído é cego.

## BehaviorOS implementation

- `packages/control-plane/versioning.ts` — Semver + `getWorkflowVersion`
- `behavior-os/state/control-plane.json` — `{version, workflows, flags}`
- `packages/observability/otel-provider.ts` + `observability/tracing.ts` — `OtelTracingProvider`, `TraceContext`
- `behavior-os/runtime/traces/demo.json` — `{traceId 32hex, parentSpanId null, spans[9], sampling}`
- `src/domain/types.ts:42-50` — `EvidenceTraces`
- `behavior-os/runtime/demo.json:controlPlane, traces, version, federation`
- `src/cli/doctor.ts:78-105 + 181-251` — valida control-plane + traces W3C + evidence consistency

## Hands-on

```bash
cat behavior-os/state/control-plane.json | python -m json.tool | head -n 30
cat behavior-os/runtime/traces/demo.json | python -c "import json; d=json.load(open('behavior-os/runtime/traces/demo.json')); print(f\"traceId={d['traceId']} spans={len(d['spans'])} parent={d['parentSpanId']}\")"
cat behavior-os/runtime/demo.json | python -c "import json; d=json.load(open('behavior-os/runtime/demo.json')); print(d['version'], d['controlPlane'], d['traces'])"
# W3C traceparent:
# 00-<traceId>-<spanId>-01
```

## OpenCode prompt

```
Leia packages/control-plane/versioning.ts e packages/observability/otel-provider.ts.
Explique: 1) como version Semver snapshot funciona por mission, 2) W3C traceId/spanId + parent chain (1 root), 3) como doctor valida evidence.traces ↔ traces file.
```

## Expected result

Explica versioning + W3C + doctor validation com arquivo:linha.

## Verification

```bash
pnpm doctor 2>&1 | grep -E "control-plane|traces|evidence.version"
cat behavior-os/runtime/traces/demo.json | grep -E "traceId|spanId"
cat behavior-os/state/control-plane.json | grep version
```

## Common mistakes

- `traceId` com `000...` → `doctor` FAIL `traceId W3C 32 hex`.
- `spans.length != stages+1` → esperado 9 (8 stages + 1 mission root).

## Troubleshooting

Traces ausente → `pnpm demo` regenera. Control-plane ausente → `pnpm demo` + `packages/control-plane/versioning.ts`.

## Challenge

Simule canário: edite `control-plane.json:flags` + rode `demo` e veja `evidence.controlPlane.flags` snapshot.

## Completion criteria

Mostra `control-plane.json` Semver + `traces/demo.json` W3C valid + `evidence.traces` match.
