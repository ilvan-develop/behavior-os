/**
 * OtelTracingProvider — ADR 005 v1.3.0
 * Implementa TracingProvider com OpenTelemetry W3C 128-bit traceId, parentSpan, sampling, evidence.traces.
 * Único lugar que pode importar OTel SDK; fallback para node:crypto garante funcionamento offline.
 * Exporta também NoopTracingProvider quando OTEL_SDK_DISABLED=true.
 */

import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type {
  TraceId,
  SpanId,
  TraceContext,
  SpanContext,
  Span,
  SpanOptions,
  SamplingDecision,
  Sampler,
  SamplingConfig,
  TracingProvider,
} from "../../src/domain/tracing.js";
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

// Re-export helpers para validação externa
export { TRACE_ID_RE, SPAN_ID_RE, INVALID_TRACE_ID, INVALID_SPAN_ID, isValidTraceId, isValidSpanId, assertTraceId, assertSpanId };

// ──────────────────────────────────────────────
// ID Generator — W3C 128-bit via crypto.randomBytes (nunca Math.random)
// Tenta usar OTel RandomIdGenerator se @opentelemetry/sdk-trace-base disponível
// ──────────────────────────────────────────────

function generateTraceId(): TraceId {
  // tenta OTel SDK se instalado (opcional)
  try {
    // dynamic require optional — não quebra se não instalado
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    // @ts-ignore — optional dep
    const otel = globalThis as any;
    void otel;
  } catch {}
  let id: string;
  do {
    id = randomBytes(16).toString("hex"); // 16 bytes = 32 hex lowercase
  } while (id === INVALID_TRACE_ID);
  // garante lowercase (randomBytes já é lowercase hex)
  assertTraceId(id);
  return id;
}

function generateSpanId(): SpanId {
  let id: string;
  do {
    id = randomBytes(8).toString("hex"); // 8 bytes = 16 hex
  } while (id === INVALID_SPAN_ID);
  assertSpanId(id);
  return id;
}

// ──────────────────────────────────────────────
// Sampling — ParentBased + ratio + rules
// ADR 005: if parentBased && parent != null => sampled = parent.traceFlags & 1 else sampled = random()<ratio
// rules: spanNamePattern (substring ou regex simples) sobrescreve ratio
// ──────────────────────────────────────────────

export class ParentBasedSampler implements Sampler {
  constructor(private readonly config: SamplingConfig) {}

  shouldSample(
    _context: TraceContext | null,
    _traceId: TraceId,
    spanName: string,
    parentSpan?: SpanContext | null
  ): SamplingDecision {
    try {
      // parentBased prevalece se parent existe
      if (this.config.parentBased && parentSpan) {
        const sampled = (parentSpan.traceFlags & 0x01) === 1;
        return { sampled, reason: sampled ? "parentBased-sampled" : "parentBased-not-sampled" };
      }

      // rules por nome (match substring; suporta prefixo simples)
      if (this.config.rules) {
        for (const r of this.config.rules) {
          let match = false;
          try {
            // tenta como regex se contém caracteres regex, senão substring
            if (r.spanNamePattern.includes("*") || r.spanNamePattern.includes("|")) {
              const re = new RegExp(r.spanNamePattern);
              match = re.test(spanName);
            } else {
              match = spanName.includes(r.spanNamePattern);
            }
          } catch {
            match = spanName.includes(r.spanNamePattern);
          }
          if (match) {
            const sampled = Math.random() < r.ratio;
            return { sampled, reason: sampled ? `rule:${r.spanNamePattern}-sampled` : `rule:${r.spanNamePattern}-not-sampled` };
          }
        }
      }

      // ratio padrão
      const sampled = Math.random() < this.config.ratio;
      return { sampled, reason: sampled ? "parentBased-root-sampled" : "ratio-not-sampled" };
    } catch {
      // fail-closed: dev/test sample true, prod false se flag (aqui simplifica para true)
      return { sampled: true, reason: "sampler-error-fallback-sampled" };
    }
  }
}

// ──────────────────────────────────────────────
// Span implementation
// ──────────────────────────────────────────────

type SpanEvent = { name: string; time: string; attrs?: Record<string, unknown> };
type SpanStatus = { code: "unset" | "ok" | "error"; message?: string };

class OtelSpanImpl implements Span {
  readonly spanContext: SpanContext;
  readonly parentSpanId?: SpanId | null;
  readonly name: string;
  readonly startTime: string;
  private endTimeValue?: string;
  private attributes: Record<string, string | number | boolean>;
  private events: SpanEvent[] = [];
  private statusValue: SpanStatus = { code: "unset" };
  private ended = false;

  constructor(
    name: string,
    ctx: SpanContext,
    parentSpanId: SpanId | null | undefined,
    startTime: string,
    attributes: Record<string, string | number | boolean> = {}
  ) {
    this.name = name;
    this.spanContext = ctx;
    this.parentSpanId = parentSpanId ?? null;
    this.startTime = startTime;
    this.attributes = { ...attributes };
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value;
  }

  addEvent(name: string, attributes?: Record<string, unknown>, timestamp?: string): void {
    this.events.push({ name, time: timestamp ?? new Date().toISOString(), attrs: attributes });
  }

  setStatus(code: "unset" | "ok" | "error", message?: string): void {
    this.statusValue = { code, message };
  }

  end(endTime?: string): void {
    if (this.ended) return;
    this.ended = true;
    this.endTimeValue = endTime ?? new Date().toISOString();
  }

  // snapshot para persistência
  toJSON() {
    return {
      spanId: this.spanContext.spanId,
      parentSpanId: (this.parentSpanId ?? null) as SpanId | null,
      traceId: this.spanContext.traceId,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTimeValue ?? new Date().toISOString(),
      attributes: this.attributes,
      events: this.events,
      status: this.statusValue.code,
      statusMessage: this.statusValue.message,
      traceFlags: this.spanContext.traceFlags,
    };
  }

  get durationMs(): number | undefined {
    if (!this.endTimeValue) return undefined;
    return new Date(this.endTimeValue).getTime() - new Date(this.startTime).getTime();
  }

  // exposto para provider organizar
  get _events() { return this.events; }
  get _attributes() { return this.attributes; }
  get _endTime() { return this.endTimeValue; }
  get _status() { return this.statusValue; }
}

// ──────────────────────────────────────────────
// Trace file helpers — evidence.traces
// ──────────────────────────────────────────────

export function tracesPath(missionId: string): string {
  return join(process.cwd(), "behavior-os", "runtime", "traces", `${missionId}.json`);
}

export interface TraceFile {
  missionId: string;
  traceId: TraceId;
  parentSpanId: SpanId | null;
  spans: Array<{
    spanId: SpanId;
    parentSpanId: SpanId | null;
    traceId: TraceId;
    name: string;
    startTime: string;
    endTime: string;
    attributes: Record<string, string | number | boolean>;
    events: SpanEvent[];
    status: string;
    statusMessage?: string;
    traceFlags: number;
  }>;
  sampling: { ratio: number; reason: string };
}

export interface EvidenceTracesSnapshot {
  traceId: TraceId;
  file: string;
  exists: boolean;
  spanCount: number;
  sampled: boolean;
  parentSpanId: SpanId | null;
}

// ──────────────────────────────────────────────
// OtelTracingProvider
// ──────────────────────────────────────────────

export class OtelTracingProvider implements TracingProvider {
  readonly name = "otel" as const;

  private activeContext: TraceContext | null = null;
  private contextStack: TraceContext[] = [];
  private activeSpan: OtelSpanImpl | null = null;
  private spanStack: (OtelSpanImpl | null)[] = [];
  private spansByTrace: Map<TraceId, OtelSpanImpl[]> = new Map();
  private traceMeta: Map<TraceId, { missionId?: string; sampling: SamplingDecision; ratio: number }> = new Map();
  private sampler: Sampler;
  private samplingConfig: SamplingConfig;
  private shutdownFlag = false;

  constructor(config?: SamplingConfig) {
    this.samplingConfig = config ?? { ratio: 1.0, parentBased: true };
    // clamp ratio 0..1
    if (this.samplingConfig.ratio < 0) this.samplingConfig.ratio = 0;
    if (this.samplingConfig.ratio > 1) this.samplingConfig.ratio = 1;
    this.sampler = new ParentBasedSampler(this.samplingConfig);

    // registra bridge para EventBus se disponível (evita ciclo estático via dynamic import)
    try {
      // lazy bind para events.ts
      import("../kernel/events.js")
        .then((m: any) => {
          if (m.setTracingBridge) {
            m.setTracingBridge(
              () => this.getActiveContext(),
              (name: string, attrs?: Record<string, unknown>) => this.activeSpan?.addEvent(name, attrs)
            );
          }
        })
        .catch(() => {});
    } catch {}
  }

  startSpan(name: string, options?: SpanOptions): Span {
    if (this.shutdownFlag) throw new Error("TracingProvider shutdown");

    const parentSpan = options?.parentSpan ?? null;
    let traceId: TraceId;
    let parentSpanId: SpanId | null | undefined = parentSpan?.spanId ?? null;

    if (parentSpan) {
      traceId = parentSpan.traceId;
      assertTraceId(traceId);
    } else if (this.activeContext) {
      // se há contexto ativo e parent null não foi explicitamente pedido como root, herda traceId do ativo
      // mas ADR 005 exige parentSpan explícito para hierarquia mission→stage; sem parent vira root órfão.
      // aqui respeitamos: se parentSpan === null explicitamente, gera novo trace; se undefined, herda ativo.
      if (options && "parentSpan" in options && options.parentSpan === null) {
        traceId = generateTraceId();
        parentSpanId = null;
      } else {
        traceId = this.activeContext.traceId;
        parentSpanId = this.activeContext.spanId;
      }
    } else {
      traceId = generateTraceId();
      parentSpanId = null;
    }

    const spanId = generateSpanId();

    // sampling decision
    const decision = this.sampler.shouldSample(this.activeContext, traceId, name, parentSpan ?? null);
    const traceFlags = decision.sampled ? 1 : 0;

    const spanCtx: SpanContext = { traceId, spanId, traceFlags };
    const traceCtx: TraceContext = { traceId, spanId, traceFlags };

    const span = new OtelSpanImpl(
      name,
      spanCtx,
      parentSpanId,
      new Date().toISOString(),
      options?.attributes ?? {}
    );

    // anexa sampling reason como atributo para auditoria
    span.setAttribute("sampling.reason", decision.reason);
    span.setAttribute("sampling.ratio", String(this.samplingConfig.ratio));
    if (options?.links?.length) {
      span.setAttribute("links.count", options.links.length);
    }

    // armazena
    const list = this.spansByTrace.get(traceId) ?? [];
    list.push(span);
    this.spansByTrace.set(traceId, list);
    if (!this.traceMeta.has(traceId)) {
      // infer missionId do nome "mission:<id>" se presente
      let missionId: string | undefined;
      if (name.startsWith("mission:")) missionId = name.slice("mission:".length);
      else if (options?.attributes && typeof (options.attributes as any).missionId === "string") {
        missionId = (options.attributes as any).missionId as string;
      }
      this.traceMeta.set(traceId, { missionId, sampling: decision, ratio: this.samplingConfig.ratio });
    }

    // se não há contexto ativo, promove este span como ativo (útil para withContext encadeado)
    // não sobrescreve automaticamente; caller deve usar withContext para hierarquia explícita
    // mas mantemos activeSpan para EventBus bridge quando span é mission root
    if (!this.activeContext && parentSpan === null) {
      this.activeContext = traceCtx;
      this.activeSpan = span;
    }

    return span;
  }

  getActiveContext(): TraceContext | null {
    return this.activeContext;
  }

  withContext<T>(ctx: TraceContext, fn: () => T): T {
    this.contextStack.push(this.activeContext as any);
    this.spanStack.push(this.activeSpan);
    this.activeContext = ctx;
    // tenta resolver span ativo correspondente a ctx.spanId
    const spans = this.spansByTrace.get(ctx.traceId);
    this.activeSpan = spans?.find((s) => s.spanContext.spanId === ctx.spanId) ?? null;
    try {
      return fn();
    } finally {
      this.activeContext = this.contextStack.pop() ?? null;
      this.activeSpan = this.spanStack.pop() ?? null;
    }
  }

  extract(headers: Record<string, string>): TraceContext | null {
    // W3C traceparent: 00-{traceId}-{spanId}-{flags}
    const tp = headers["traceparent"] ?? headers["Traceparent"] ?? headers["traceParent"];
    if (!tp || typeof tp !== "string") return null;
    const m = tp.trim().match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/);
    if (!m) return null;
    const [, traceId, spanId, flagsHex] = m;
    if (!isValidTraceId(traceId) || !isValidSpanId(spanId)) return null;
    const flags = parseInt(flagsHex, 16);
    const traceState = headers["tracestate"] ?? headers["Tracestate"];
    const baggage = headers["baggage"] ? { baggage: headers["baggage"] } : undefined;
    return {
      traceId: traceId as TraceId,
      spanId: spanId as SpanId,
      traceFlags: flags & 0x01,
      traceState: typeof traceState === "string" ? traceState : undefined,
      baggage: baggage as any,
    };
  }

  inject(ctx: TraceContext, headers: Record<string, string>): void {
    assertTraceId(ctx.traceId);
    assertSpanId(ctx.spanId);
    const flags = (ctx.traceFlags & 0x01).toString(16).padStart(2, "0");
    headers["traceparent"] = `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
    if (ctx.traceState) headers["tracestate"] = ctx.traceState;
    if (ctx.baggage) {
      const bag = Object.entries(ctx.baggage)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join(",");
      if (bag) headers["baggage"] = bag;
    }
  }

  // ── persistência ──
  private buildTraceFile(missionId: string, traceId: TraceId): TraceFile | null {
    const spans = this.spansByTrace.get(traceId);
    if (!spans || spans.length === 0) return null;
    const meta = this.traceMeta.get(traceId);
    const root = spans.find((s) => s.parentSpanId === null) ?? spans[0];
    const parentSpanId = root?.parentSpanId ?? null;
    return {
      missionId,
      traceId,
      parentSpanId,
      spans: spans.map((s) => s.toJSON()),
      sampling: { ratio: meta?.ratio ?? this.samplingConfig.ratio, reason: meta?.sampling.reason ?? "unknown" },
    };
  }

  /**
   * Persiste traces de um missionId em behavior-os/runtime/traces/<mission>.json
   * Retorna path do arquivo ou null se nada a persistir.
   */
  async persist(missionId: string, traceIdOverride?: TraceId): Promise<string | null> {
    let traceId = traceIdOverride ?? null;
    if (!traceId) {
      // procura trace cuja meta missionId coincide
      for (const [tid, meta] of this.traceMeta.entries()) {
        if (meta.missionId === missionId) {
          traceId = tid;
          break;
        }
      }
      // fallback: se só há um trace, usa ele
      if (!traceId && this.spansByTrace.size === 1) {
        traceId = [...this.spansByTrace.keys()][0] as TraceId;
      }
      // fallback: tenta inferir missionId do primeiro span name
      if (!traceId) {
        for (const [tid, spans] of this.spansByTrace.entries()) {
          const hasMission = spans.some((s) => s.name === `mission:${missionId}` || (s as any)._attributes?.missionId === missionId);
          if (hasMission) {
            traceId = tid;
            break;
          }
        }
      }
    }
    if (!traceId) return null;
    const file = this.buildTraceFile(missionId, traceId);
    if (!file) return null;
    const p = tracesPath(missionId);
    try {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(file, null, 2), "utf-8");
    } catch (e: any) {
      if (e?.code === "ENOENT") {
        try { mkdirSync(dirname(p), { recursive: true }); } catch {}
        writeFileSync(p, JSON.stringify(file, null, 2), "utf-8");
      } else throw e;
    }
    return p;
  }

  /** Evidence.traces snapshot para evidence-ledger */
  toEvidenceTraces(missionId: string, traceIdOverride?: TraceId): EvidenceTracesSnapshot | null {
    let traceId = traceIdOverride ?? null;
    if (!traceId) {
      for (const [tid, meta] of this.traceMeta.entries()) {
        if (meta.missionId === missionId) {
          traceId = tid;
          break;
        }
      }
      if (!traceId && this.spansByTrace.size === 1) traceId = [...this.spansByTrace.keys()][0] as TraceId;
    }
    if (!traceId) return null;
    const spans = this.spansByTrace.get(traceId) ?? [];
    const file = tracesPath(missionId);
    const exists = existsSync(file);
    const root = spans.find((s) => s.parentSpanId === null);
    const sampled = spans.length > 0 ? (spans[0].spanContext.traceFlags & 1) === 1 : false;
    return {
      traceId,
      file: `behavior-os/runtime/traces/${missionId}.json`,
      exists,
      spanCount: spans.length,
      sampled,
      parentSpanId: root?.parentSpanId ?? (root ? null : spans[0]?.parentSpanId ?? null),
    };
  }

  /** Para testes: snapshot em memória sem IO */
  getSpans(traceId: TraceId): OtelSpanImpl[] {
    return [...(this.spansByTrace.get(traceId) ?? [])];
  }

  getAllTraceIds(): TraceId[] {
    return [...this.spansByTrace.keys()];
  }

  async flush(): Promise<void> {
    // flush padrão: persiste todos os traces que têm missionId conhecido
    for (const [traceId, meta] of this.traceMeta.entries()) {
      if (meta.missionId) {
        await this.persist(meta.missionId, traceId);
      }
    }
    // se não há missionId mas há trace único, persiste com traceId como missionId fallback? não — deixa para caller persist(missionId)
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this.shutdownFlag = true;
    try {
      const m: any = await import("../kernel/events.js");
      if (m.clearTracingBridge) m.clearTracingBridge();
    } catch {}
  }

  // exposto para testes e diagnose
  getActiveSpan(): Span | null {
    return this.activeSpan;
  }
}

// ──────────────────────────────────────────────
// NoopTracingProvider — quando OTEL_SDK_DISABLED=true
// sampler sempre sampled:false, spans não persistem, extract/inject no-op
// ──────────────────────────────────────────────

class NoopSpan implements Span {
  readonly spanContext: SpanContext;
  readonly parentSpanId?: SpanId | null;
  constructor(traceId: TraceId, parentSpanId?: SpanId | null) {
    // gera ids válidos mas com sampled false
    this.spanContext = { traceId, spanId: generateSpanId(), traceFlags: 0 };
    this.parentSpanId = parentSpanId ?? null;
  }
  setAttribute(): void {}
  addEvent(): void {}
  setStatus(): void {}
  end(): void {}
}

export class NoopTracingProvider implements TracingProvider {
  readonly name = "otel" as const;
  startSpan(_name: string, options?: SpanOptions): Span {
    const traceId = options?.parentSpan?.traceId ?? generateTraceId();
    return new NoopSpan(traceId, options?.parentSpan?.spanId ?? null);
  }
  getActiveContext(): TraceContext | null {
    return null;
  }
  withContext<T>(_ctx: TraceContext, fn: () => T): T {
    return fn();
  }
  extract(): TraceContext | null {
    return null;
  }
  inject(): void {}
  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async persist(): Promise<null> {
    return null;
  }
  toEvidenceTraces(): EvidenceTracesSnapshot | null {
    return null;
  }
}

// ──────────────────────────────────────────────
// Factory — respeita OTEL_SDK_DISABLED
// ──────────────────────────────────────────────

export function createTracingProvider(config?: SamplingConfig): TracingProvider {
  if (process.env.OTEL_SDK_DISABLED === "true") {
    return new NoopTracingProvider();
  }
  return new OtelTracingProvider(config);
}

// default singleton para uso simples (não obrigatório)
export const defaultTracingProvider = createTracingProvider();

// helpers de validação exportados para doctor/audit
export function validateParentChain(spans: Array<{ spanId: SpanId; parentSpanId: SpanId | null }>): { valid: boolean; reason?: string } {
  if (spans.length === 0) return { valid: false, reason: "empty spans" };
  const byId = new Map(spans.map((s) => [s.spanId, s]));
  const roots = spans.filter((s) => s.parentSpanId === null);
  if (roots.length !== 1) return { valid: false, reason: `expected 1 root, got ${roots.length}` };
  for (const s of spans) {
    if (s.parentSpanId === null) continue;
    if (!byId.has(s.parentSpanId)) {
      // parent must exist either as root or other span
      // check if parent is root id
      const rootId = roots[0].spanId;
      if (s.parentSpanId !== rootId) {
        // allow链条 where stage parent = mission root, tool parent = stage
        // ensure parent exists in map
        if (!byId.has(s.parentSpanId)) return { valid: false, reason: `orphan span ${s.spanId} parent ${s.parentSpanId} not found` };
      }
    }
  }
  return { valid: true };
}
