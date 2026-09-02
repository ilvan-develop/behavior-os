/**
 * Observability — OpenTelemetry W3C 128-bit tracing (ADR 005 v1.3.0)
 * Produção: W3C traceId/spanId via crypto.randomBytes, parentSpan hierárquico,
 * sampling parentBased, persistência behavior-os/runtime/traces/<mission>.json
 * e evidence.traces. Mantém compatibilidade legacy startTrace/endTrace/getTraces.
 * Compatível com packages/observability/otel-provider.ts (adapter único OTel).
 */

import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import type { TraceId, SpanId, SpanContext, TraceContext } from "../../src/domain/tracing.js";
import {
  TRACE_ID_RE,
  SPAN_ID_RE,
  INVALID_TRACE_ID,
  INVALID_SPAN_ID,
  isValidTraceId,
  isValidSpanId,
  assertTraceId,
  assertSpanId,
} from "../../src/domain/tracing.js";
import {
  defaultTracingProvider,
  createTracingProvider,
  tracesPath,
  validateParentChain,
  OtelTracingProvider,
  ParentBasedSampler,
} from "./otel-provider.js";
import type { TracingProvider, Span } from "../../src/domain/tracing.js";

// Re-export W3C helpers e path para doctor/audit externos
export { TRACE_ID_RE, SPAN_ID_RE, INVALID_TRACE_ID, INVALID_SPAN_ID, isValidTraceId, isValidSpanId, assertTraceId, assertSpanId, tracesPath, validateParentChain, OtelTracingProvider, ParentBasedSampler };
export { createTracingProvider };
export type { TracingProvider, Span, TraceId, SpanId, SpanContext, TraceContext };

// Singleton canônico — reutiliza defaultTracingProvider do otel-provider para estado unificado
export const tracingProvider: TracingProvider = defaultTracingProvider as TracingProvider;

// ——— Legacy TraceSpan — agora W3C + parentSpanId (compatível: campos novos são obrigatórios mas todos os antigos permanecem) ———
export interface TraceSpan {
  traceId: TraceId;
  spanId: SpanId;
  parentSpanId: SpanId | null;
  stage: string;
  agent: string;
  start: string;
  end?: string;
  durationMs?: number;
  status: "ok" | "error";
  attributes?: Record<string, string | number | boolean>;
  name?: string; // nome OTel original (mission:*, stage:*)
}

// Mapa legacy spanId -> Span (para endTrace rápido)
const spanBySpanId = new Map<string, Span>();

// Helper para extrair stage/agent de span OTel
function spanToTraceSpan(sp: any): TraceSpan {
  const j = typeof sp.toJSON === "function" ? sp.toJSON() : sp;
  const attrs: Record<string, any> = j.attributes ?? {};
  // nome original: "mission:demo" ou "stage:discover"
  const rawName: string = j.name ?? "";
  let stage: string = (attrs.stage as string) ?? rawName.replace(/^stage:/, "").replace(/^mission:/, "");
  let agent: string = (attrs.agent as string) ?? "unknown";
  // se mission root, stage = missionId
  if (rawName.startsWith("mission:")) {
    stage = rawName.slice("mission:".length);
    agent = (attrs.workflowId as string) ?? agent;
  }
  const start: string = j.startTime ?? new Date().toISOString();
  const end: string | undefined = j.endTime;
  const durationMs = end ? new Date(end).getTime() - new Date(start).getTime() : undefined;
  const status = j.status === "error" ? "error" : "ok";
  return {
    traceId: j.traceId as TraceId,
    spanId: j.spanId as SpanId,
    parentSpanId: (j.parentSpanId ?? null) as SpanId | null,
    stage,
    agent,
    start,
    end,
    durationMs,
    status,
    attributes: attrs,
    name: rawName,
  };
}

/**
 * startTrace — legacy compatível, agora W3C 128-bit.
 * Antes: `trace-${stage}-${Date.now()}` (quebra W3C). Agora: cria span OTel com spanId W3C.
 * @param stage id do stage (ex: discover)
 * @param agent nome do agent (ex: researcher)
 * @param parentSpan opcional — se fornecido, herda traceId (hierarquia mission→stage→tool). Se null, cria root.
 * @returns spanId (W3C 16 hex) — usar em endTrace(spanId)
 */
export function startTrace(stage: string, agent: string, parentSpan?: SpanContext | null): string {
  const opts: any = { attributes: { stage, agent } };
  if (parentSpan !== undefined) opts.parentSpan = parentSpan;
  // se já existe contexto ativo mission, sem parent explícito mas stage deve ser filho do mission:
  // delega ao provider que já resolve herança via activeContext e parentSpan
  const span = (tracingProvider as any).startSpan(`stage:${stage}`, opts) as Span;
  spanBySpanId.set(span.spanContext.spanId, span);
  // também guarda por traceId para compatibilidade antiga que buscava por traceId
  spanBySpanId.set(span.spanContext.traceId, span);
  return span.spanContext.spanId;
}

/**
 * startMissionTrace — helper produção para mission root (parentSpan: null explícito).
 * @returns traceId W3C
 */
export function startMissionTrace(missionId: string, workflowId?: string, attributes?: Record<string, string | number | boolean>): { traceId: TraceId; spanId: SpanId; span: Span } {
  const span = (tracingProvider as any).startSpan(`mission:${missionId}`, {
    parentSpan: null,
    attributes: { missionId, ...(workflowId ? { workflowId } : {}), ...(attributes ?? {}) },
  }) as Span;
  spanBySpanId.set(span.spanContext.spanId, span);
  spanBySpanId.set(span.spanContext.traceId, span);
  return { traceId: span.spanContext.traceId as TraceId, spanId: span.spanContext.spanId as SpanId, span };
}

export function endTrace(spanIdOrTraceId: string, status: "ok" | "error" = "ok"): void {
  // tenta lookup direto
  let sp: any = spanBySpanId.get(spanIdOrTraceId);
  if (!sp) {
    // busca em provider por spanId ou traceId
    const prov: any = tracingProvider as any;
    if (prov.getSpans && prov.getAllTraceIds) {
      for (const tid of prov.getAllTraceIds() as string[]) {
        const list = prov.getSpans(tid) as any[];
        const found = list.find((s: any) => s.spanContext.spanId === spanIdOrTraceId || s.spanContext.traceId === spanIdOrTraceId);
        if (found) { sp = found; break; }
      }
      // fallback: se só há um span com traceId correspondente
      if (!sp) {
        for (const tid of prov.getAllTraceIds() as string[]) {
          if (tid === spanIdOrTraceId) {
            const list = prov.getSpans(tid) as any[];
            if (list.length) sp = list[list.length - 1];
            break;
          }
        }
      }
    }
  }
  if (sp) {
    try {
      sp.setStatus(status as any);
    } catch {}
    try {
      sp.end();
    } catch {}
  }
}

export function getTraces(): TraceSpan[] {
  const prov: any = tracingProvider as any;
  if (prov.getSpans && prov.getAllTraceIds) {
    const out: TraceSpan[] = [];
    for (const tid of prov.getAllTraceIds() as string[]) {
      const list = prov.getSpans(tid) as any[];
      for (const s of list) out.push(spanToTraceSpan(s));
    }
    // ordena por startTime para estabilidade
    out.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return out;
  }
  return [];
}

// ——— Produção: delegações diretas ao provider ———

export function getActiveContext(): TraceContext | null {
  return (tracingProvider as any).getActiveContext?.() ?? null;
}

export function withContext<T>(ctx: TraceContext, fn: () => T): T {
  return (tracingProvider as any).withContext(ctx, fn);
}

export function extract(headers: Record<string, string>): TraceContext | null {
  return (tracingProvider as any).extract(headers);
}

export function inject(ctx: TraceContext, headers: Record<string, string>): void {
  return (tracingProvider as any).inject(ctx, headers);
}

export async function persistTraces(missionId: string, traceIdOverride?: TraceId): Promise<string | null> {
  const prov: any = tracingProvider as any;
  if (prov.persist) return prov.persist(missionId, traceIdOverride);
  return null;
}

export function toEvidenceTraces(missionId: string, traceIdOverride?: TraceId): import("./otel-provider.js").EvidenceTracesSnapshot | null {
  const prov: any = tracingProvider as any;
  if (prov.toEvidenceTraces) return prov.toEvidenceTraces(missionId, traceIdOverride);
  try {
    const p = tracesPath(missionId);
    if (!existsSync(p)) return null;
    const data = JSON.parse(readFileSync(p, "utf-8"));
    return {
      traceId: data.traceId,
      file: `behavior-os/runtime/traces/${missionId}.json`,
      exists: true,
      spanCount: data.spans?.length ?? 0,
      sampled: (data.spans?.[0]?.traceFlags & 1) === 1,
      parentSpanId: data.parentSpanId ?? null,
    };
  } catch { return null; }
}

export async function flush(): Promise<void> {
  const prov: any = tracingProvider as any;
  if (prov.flush) await prov.flush();
}

export async function shutdown(): Promise<void> {
  const prov: any = tracingProvider as any;
  if (prov.shutdown) await prov.shutdown();
}

// Compat: expõe generate helpers via re-export (validação W3C)
export function generateTraceId(): TraceId {
  let id: string;
  do { id = randomBytes(16).toString("hex"); } while (id === INVALID_TRACE_ID);
  assertTraceId(id);
  return id as TraceId;
}

// Limpeza para testes (não quebra isolamento se chamado)
export function _resetForTests(): void {
  try {
    const prov: any = tracingProvider as any;
    if (prov.spansByTrace) prov.spansByTrace.clear();
    if (prov.traceMeta) prov.traceMeta.clear();
    if (prov.contextStack) prov.contextStack.length = 0;
    if (prov.spanStack) prov.spanStack.length = 0;
    prov.activeContext = null;
    prov.activeSpan = null;
  } catch {}
  spanBySpanId.clear();
}

// Re-export default para `import tracing from ...`
export default tracingProvider;
