# ADR 005 — Observability com OpenTelemetry (TracingProvider + EventBus)

**Status:** Proposed | **Versão:** behaviorOS v1.3.0 | **Data:** 2026-09-02 | **Decide:** TracingProvider OTel SDK W3C 128-bit + EventBus `packages/kernel/events.ts` + `evidence.traces` em `behavior-os/runtime/traces/<mission>.json`
**Relacionados:** ADR 001 (Core boundaries), ADR 002 (Evidence-first), ARCHITECTURE v1.1 (Kernel/Mission Engine/Evidence), `src/domain` vs `src/core` vs `adapters`

---

## Contexto

`v1.2.0` entregou `packages/observability/tracing.ts` como traço por stage, mas sem contrato formal, sem correlação W3C e sem evidência observável gateável. O princípio `Mission → Workflow Engine → Agents → Skills → Governance → Evidence` exige que observabilidade seja **evidência auditável**, não log volátil.

Problemas sem ADR:
- Sem interface abstrai OTel: `src/core` importaria SDK direto (quebra ADR 001).
- Sem `traceId` W3C 128-bit não há correlação entre `Mission` → `WorkflowStage` → `Agent` → `Governance`.
- Sem `parentSpan` não há hierarquia `mission root span → stage span → tool span`.
- Sem `sampling` há custo excessivo em `demo:parallel`/`autonomous`.
- Sem artefato em disco `Configuração não é integração` (Regra de Ouro) é violada: tracing ficaria só em memória.
- `packages/kernel/events.ts` hoje é `bus: KernelEvent[]` em memória sem bridge para spans.

Objetivo `v1.3.0 (LEARN-05)`: definir contrato **sem implementar código** que permita em `v1.3` plugar OTel SDK, manter `src/core` puro e gerar `behavior-os/runtime/traces/<mission>.json` observável por `pnpm doctor`/`audit`.

## Decisão

### 1. Fronteiras (respeito a `src/domain` vs `src/core` vs `adapters`)

```
src/domain/tracing.ts        → contratos (TracingProvider, TraceContext, Span, Sampling)
src/core/mission-engine.ts   → orquestra via TracingProvider injetado (não importa @opentelemetry/*)
packages/observability/*     → adapter OTel (único lugar que importa @opentelemetry/sdk-trace-base|api)
src/adapters/otel/*          → alternativa física se `packages/*` não for usado (escolher 1; preferir packages/observability)
packages/kernel/events.ts    → EventBus (emite KernelEvent → bridge para SpanEvents)
behavior-os/runtime/traces/<mission>.json → evidência observável (Regra de Ouro)
```

`Kernel` nunca importa adapters. `evidence-ledger.ts` compõe `Evidence.traces` a partir do provider.

### 2. Contrato `TracingProvider` (interface única)

```ts
// src/domain/tracing.ts — sem dependência OTel, apenas tipos abstratos
export type TraceId = string; // W3C 128-bit: /^[0-9a-f]{32}$/  (32 hex, lowercase, != 000...0)
export type SpanId  = string; // W3C 64-bit: /^[0-9a-f]{16}$/

export interface TraceContext {
  traceId: TraceId;
  spanId: SpanId;
  traceFlags: number; // bit 0 = sampled (W3C trace-flags)
  traceState?: string; // W3C tracestate
  baggage?: Record<string,string>;
}

export interface SpanOptions {
  parentSpan?: SpanContext | null; // null = root (mission)
  attributes?: Record<string, string|number|boolean>;
  links?: SpanContext[];
}

export interface SpanContext { traceId: TraceId; spanId: SpanId; traceFlags: number; }

export interface Span {
  readonly spanContext: SpanContext;
  readonly parentSpanId?: SpanId | null;
  setAttribute(key: string, value: string|number|boolean): void;
  addEvent(name: string, attributes?: Record<string, unknown>, timestamp?: string): void;
  setStatus(code: "unset"|"ok"|"error", message?: string): void;
  end(endTime?: string): void;
}

export type SamplingDecision = { sampled: boolean; reason: string };

export interface Sampler {
  shouldSample(context: TraceContext | null, traceId: TraceId, spanName: string, parentSpan?: SpanContext | null): SamplingDecision;
}

export interface TracingProvider {
  readonly name: "otel";
  startSpan(name: string, options?: SpanOptions): Span;
  getActiveContext(): TraceContext | null;
  withContext<T>(ctx: TraceContext, fn: () => T): T;
  extract(headers: Record<string,string>): TraceContext | null;  // W3C traceparent/tracestate → contexto
  inject(ctx: TraceContext, headers: Record<string,string>): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
```

**Regras:**
- `traceId` **sempre** gerado via OTel `RandomIdGenerator` (W3C 128-bit, 32 hex, `crypto.randomBytes(16)`), nunca `Math.random` nem `Date.now`.
- `spanId` 64-bit (16 hex) por span.
- `parentSpan` explícito: `mission` = root span (`parentSpan: null`), cada `WorkflowStage` cria span filho com `parentSpan = missionSpan.spanContext`, tools criam neto.
- `TraceContext` imutável após criação; propagação via `inject/extract` usando header `traceparent: 00-{traceId}-{spanId}-{flags}` (W3C).

### 3. OpenTelemetry SDK — mapeamento

- **SDK:** `@opentelemetry/api` ^1.9 + `@opentelemetry/sdk-trace-base` ^1.30 + `@opentelemetry/exporter-trace-otlp-http` opcional.
- **Implementação:** `packages/observability/otel-provider.ts implements TracingProvider` encapsula `BasicTracerProvider` + `BatchSpanProcessor` + `W3CTraceContextPropagator`.
- **Exporter padrão v1.3:** `InMemory` + `FileSpanExporter` → `behavior-os/runtime/traces/<mission>.json` (não OTLP remoto ainda). OTLP fica atrás de flag `OTEL_EXPORTER_OTLP_ENDPOINT`.
- **Instrumentação:** sem auto-instrumentação em `v1.3`; spans manuais em `mission-engine.executeMission` e `workflow/engine.runStage`.
- **Compatibilidade:** se `OTEL_SDK_DISABLED=true` provider vira `NoopTracingProvider` (sampler retorna `sampled:false`).

### 4. `traceId` W3C 128-bit

```ts
// invariantes validáveis em teste
const TRACE_ID_RE = /^[0-9a-f]{32}$/;
const SPAN_ID_RE  = /^[0-9a-f]{16}$/;
function assertTraceId(id: TraceId) {
  if (!TRACE_ID_RE.test(id) || id === "00000000000000000000000000000000") throw new Error(`Invalid W3C traceId ${id}`);
}
```
- Fonte única: `packages/observability/id-generator.ts` → `otel RandomIdGenerator` (ou `node:crypto` fallback).
- `mission.id` **não** é `traceId`; `traceId` é correlacionado e persistido em `evidence.traces.traceId`.

### 5. `parentSpan` — hierarquia mission → stage → tool

```
mission:demo (traceId=4bf92f3577b34da6a3ce929d0e0e4736, spanId=root)
 ├─ stage:discover (parent=rRoot)
 ├─ stage:plan     (parent=rRoot, link→discover se paralelo)
 ├─ stage:architect(parent=rRoot)
 └─ stage:implement(parent=rRoot)
     └─ tool:bash::pnpm typecheck (parent=implement span)
```

Contrato: `TracingProvider.startSpan(stageId, { parentSpan: missionSpan.spanContext })`. Sem `parentSpan` o stage vira root órfão (proibido; `doctor` falha).

### 6. Sampling

```ts
export interface SamplingConfig {
  ratio: number; // 0..1 (ex: 1.0 dev, 0.1 prod)
  parentBased: boolean; // default true: respeita traceFlags do parent
  rules?: Array<{ spanNamePattern: string; ratio: number }>; // ex: security-audit 1.0
}
// decisão: if parentBased && parent != null => sampled = parent.traceFlags & 1 else sampled = random() < ratio
```

- Default `v1.3`: `ratio=1.0` (sample all), `parentBased=true`. `prod` pode usar `0.1`.
- `SamplingDecision.reason` persistido em trace (`sampling.reason` attribute) para auditoria.
- Fail-closed: erro no sampler → `sampled:true` em dev/test, `false` em prod apenas se flag.

### 7. Evidência observável `evidence.traces` + `behavior-os/runtime/traces/<mission>.json`

**Extensão em `src/domain/types.ts`:**
```ts
export interface Evidence {
  // ...existentes
  traces?: {
    traceId: TraceId;
    file: string; // behavior-os/runtime/traces/<mission>.json
    exists: boolean;
    spanCount: number;
    sampled: boolean;
    parentSpanId: SpanId | null;
  };
}
```

**Artefato `behavior-os/runtime/traces/<mission>.json`:**
```json
{
  "missionId": "demo",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "parentSpanId": "00f067aa0ba902b7",
  "spans": [
    { "spanId": "00f067aa0ba902b7", "parentSpanId": null, "name": "mission:demo", "startTime": "2026-09-02T15:31:53.793Z", "endTime": "2026-09-02T15:31:54.065Z", "attributes": { "workflowId": "development" }, "events": [], "status": "ok" },
    { "spanId": "a1b2c3d4e5f6a7b8", "parentSpanId": "00f067aa0ba902b7", "name": "stage:discover", "startTime": "...", "endTime": "...", "attributes": { "agent": "researcher" }, "events": [{ "name": "kernel.emit", "time": "...", "attrs": { "type": "mission.start" }}], "status": "ok" }
  ],
  "sampling": { "ratio": 1.0, "reason": "parentBased-root-sampled" }
}
```

**Regra de Ouro (evidência):**
- `tracing` funcional ⇔ `behavior-os/runtime/traces/<mission>.json` existe **e** `spans.length === workflow.stages.length + 1` **e** `traceId` W3C válido **e** `spans[].parentSpanId` encadeado corretamente até root.
- `evidence-ledger.ts` após `complete()`: chama `tracingProvider.flush()` e escreve `evidence.traces`.
- `pnpm doctor` verifica: `existsSync(tracesFile)` + `JSON.parse` + regex W3C + parent chain.
- `pnpm demo` deve gerar `traces/demo.json` com `status ok`.

### 8. EventBus `packages/kernel/events.ts` — bridge para OTel

Extensão compatível (não quebra `emit/getEvents/clearEvents`):

```ts
// packages/kernel/events.ts
export interface KernelEvent { type: string; missionId: string; timestamp: string; traceId?: TraceId; spanId?: SpanId; [k:string]: unknown; }

type Listener = (e: KernelEvent) => void;
const listeners = new Set<Listener>();
export function on(listener: Listener): () => void { listeners.add(listener); return () => listeners.delete(listener); }

export function emit(event: KernelEvent): void {
  // 1) enriquece com contexto ativo se TracingProvider disponível
  const ctx = globalTracingContext?.getActiveContext?.() ?? null;
  if (ctx && !event.traceId) { event.traceId = ctx.traceId; event.spanId = ctx.spanId; }
  bus.push(event);
  // 2) fan-out síncrono para listeners (bridge OTel)
  for (const l of listeners) try { l(event); } catch {}
  // 3) se span ativo, adiciona SpanEvent
  activeSpan?.addEvent(event.type, { ...event, timestamp: event.timestamp });
}
```

- Provider registra `on((e) => currentSpan.addEvent(e.type))` durante `executeMission`.
- `getEvents(missionId)` continua funcionando; `clearEvents()` limpa bus mas não spans (spans são on-disk).
- `EventBus` permanece síncrono e em memória; `traces/*.json` é o durable log.

---

## Consequências

**Positivas:**
- `src/core` desacoplado de OTel; testes unitários usam `NoopTracingProvider` sem SDK.
- Correlação W3C permite `traceId` compartilhado entre `evidence.json` ↔ `traces/<mission>.json` ↔ headers HTTP (futuro OTLP).
- Hierarquia `parentSpan` viabiliza flame-graph por mission e detecção de stage órfão.
- `sampling` controla custo; `evidence.traces.sampled` audita decisão.
- Evidência observável fecha gate: `doctor` falha se traces ausente/corrompido (fail-closed).
- `EventBus` vira única fonte para `KernelEvent` → `SpanEvent` sem duplicar `emit`.

**Negativas / Mitigações:**
- Duplo artefato (`evidence.json` + `traces/*.json`) → mitigado por `evidence.traces.file` apontar para trace (link, não duplicação).
- Overhead `BatchSpanProcessor` → mitigado por `ratio 1.0` só em dev/demo; prod 0.1.
- `packages/kernel/events.ts` global `bus` não é multi-processo → documentado como `in-memory per process`; durable é `traces/*.json`.

**Gates v1.3.0 (não implementar agora, só contrato):**
- [ ] `src/domain/tracing.ts` com interfaces acima + regex W3C exportados
- [ ] `packages/observability/otel-provider.ts implements TracingProvider` (imports OTel isolados)
- [ ] `packages/kernel/events.ts` com `on/emit(traceId)` bridge
- [ ] `src/core/evidence-ledger.ts` estendido com `traces` + `flush()`
- [ ] `behavior-os/runtime/traces/<mission>.json` gerado em `demo` com `spans = stages+1`
- [ ] `vitest` → `W3C traceId/spanId regex`, `parentSpan chain`, `sampling parentBased`, `evidence.traces exists`
- [ ] `pnpm doctor` verifica `traces/*.json` (doctor estendido)

## Alternativas Consideradas

1. **OTel direto em `src/core`** — rejeitado: quebra ADR 001, impede `Noop` em testes.
2. **Logs JSONL em vez de traces** — rejeitado: sem `parentSpan` hierárquico, sem W3C.
3. **Exporter OTLP remoto obrigatório** — rejeitado: `v1.3` deve funcionar offline; OTLP fica opcional.
4. **TraceId = missionId** — rejeitado: missionId é legível, não garante unicidade W3C 32-hex.

## Referências

- `docs/ARCHITECTURE.md` v1.1 — Fronteiras Kernel/Mission/Evidence/OpenCode/Graphify/LangGraph
- `src/domain/types.ts` → `Evidence` + `GovernanceVerdict`
- `src/core/evidence-ledger.ts` → `evidencePath()` + `write()`
- `packages/kernel/events.ts` (antes: `bus: KernelEvent[]`, `emit/getEvents/clearEvents`)
- `packages/observability/tracing.ts` (v1.2 stub) → evolui para `otel-provider.ts`
- W3C Trace Context: `traceparent: 00-{32 hex}-{16 hex}-{2 hex}` + `tracestate`
- OpenTelemetry JS: `@opentelemetry/api` `BasicTracerProvider` `BatchSpanProcessor` `W3CTraceContextPropagator`

> **Nota:** Este ADR é **especificação**. Não requer implementação de código em `v1.3.0-proposal`; gates acima são critérios de aceite quando implementado.

