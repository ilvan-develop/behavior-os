/** TracingProvider contract — ADR 005 v1.3.0
 * Sem dependência OTel, apenas tipos abstratos.
 * Fronteira: src/domain/tracing.ts → contratos; packages/observability/otel-provider.ts → adapter.
 */

export type TraceId = string; // W3C 128-bit: /^[0-9a-f]{32}$/ lowercase, != 000...0
export type SpanId = string; // W3C 64-bit: /^[0-9a-f]{16}$/ lowercase, != 000...0

export const TRACE_ID_RE = /^[0-9a-f]{32}$/;
export const SPAN_ID_RE = /^[0-9a-f]{16}$/;
export const TRACE_PARENT_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
export const INVALID_TRACE_ID = "00000000000000000000000000000000";
export const INVALID_SPAN_ID = "0000000000000000";

export function isValidTraceId(id: string): boolean {
  return TRACE_ID_RE.test(id) && id !== INVALID_TRACE_ID;
}

export function isValidSpanId(id: string): boolean {
  return SPAN_ID_RE.test(id) && id !== INVALID_SPAN_ID;
}

export function assertTraceId(id: TraceId): void {
  if (!isValidTraceId(id)) throw new Error(`Invalid W3C traceId ${id}`);
}

export function assertSpanId(id: SpanId): void {
  if (!isValidSpanId(id)) throw new Error(`Invalid W3C spanId ${id}`);
}

export interface TraceContext {
  traceId: TraceId;
  spanId: SpanId;
  traceFlags: number; // bit 0 = sampled (W3C trace-flags)
  traceState?: string; // W3C tracestate
  baggage?: Record<string, string>;
}

export interface SpanContext {
  traceId: TraceId;
  spanId: SpanId;
  traceFlags: number;
}

export interface SpanOptions {
  parentSpan?: SpanContext | null; // null = root (mission)
  attributes?: Record<string, string | number | boolean>;
  links?: SpanContext[];
}

export interface Span {
  readonly spanContext: SpanContext;
  readonly parentSpanId?: SpanId | null;
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: Record<string, unknown>, timestamp?: string): void;
  setStatus(code: "unset" | "ok" | "error", message?: string): void;
  end(endTime?: string): void;
}

export type SamplingDecision = { sampled: boolean; reason: string };

export interface Sampler {
  shouldSample(
    context: TraceContext | null,
    traceId: TraceId,
    spanName: string,
    parentSpan?: SpanContext | null
  ): SamplingDecision;
}

export interface SamplingConfig {
  ratio: number; // 0..1 (ex: 1.0 dev, 0.1 prod)
  parentBased: boolean; // default true: respeita traceFlags do parent
  rules?: Array<{ spanNamePattern: string; ratio: number }>; // ex: security-audit 1.0
}

export interface TracingProvider {
  readonly name: "otel";
  startSpan(name: string, options?: SpanOptions): Span;
  getActiveContext(): TraceContext | null;
  withContext<T>(ctx: TraceContext, fn: () => T): T;
  extract(headers: Record<string, string>): TraceContext | null; // W3C traceparent/tracestate → contexto
  inject(ctx: TraceContext, headers: Record<string, string>): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
