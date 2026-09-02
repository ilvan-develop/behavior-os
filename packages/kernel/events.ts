import type { TraceId, SpanId } from "../../src/domain/tracing.js";

export interface KernelEvent {
  type: string;
  missionId: string;
  timestamp: string;
  traceId?: TraceId;
  spanId?: SpanId;
  [key: string]: unknown;
}

type Listener = (e: KernelEvent) => void;

const bus: KernelEvent[] = [];
const listeners = new Set<Listener>();

// Bridge OTel — setters opcionais para evitar import cíclico
let activeContextGetter: (() => { traceId: TraceId; spanId: SpanId } | null) | null = null;
let activeSpanAdder: ((name: string, attrs?: Record<string, unknown>) => void) | null = null;

export function setTracingBridge(
  getCtx: () => { traceId: TraceId; spanId: SpanId } | null,
  addSpanEvent: (name: string, attrs?: Record<string, unknown>) => void
): void {
  activeContextGetter = getCtx;
  activeSpanAdder = addSpanEvent;
}

export function clearTracingBridge(): void {
  activeContextGetter = null;
  activeSpanAdder = null;
}

export function on(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit(event: KernelEvent): void {
  // 1) enriquece com contexto ativo se TracingProvider disponível
  try {
    const ctx = activeContextGetter?.() ?? null;
    if (ctx && !event.traceId) {
      event.traceId = ctx.traceId;
      event.spanId = ctx.spanId;
    }
  } catch {}
  bus.push(event);
  // 2) fan-out síncrono para listeners (bridge OTel)
  for (const l of listeners) {
    try {
      l(event);
    } catch {}
  }
  // 3) se span ativo, adiciona SpanEvent
  try {
    activeSpanAdder?.(event.type, { ...event, timestamp: event.timestamp } as Record<string, unknown>);
  } catch {}
}

export function getEvents(missionId?: string): KernelEvent[] {
  return missionId ? bus.filter((e) => e.missionId === missionId) : [...bus];
}

export function clearEvents(): void {
  bus.length = 0;
}
