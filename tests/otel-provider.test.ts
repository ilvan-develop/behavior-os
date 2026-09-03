import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";

// hoisted mocks — must be before imports of subject
vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<typeof import("node:crypto")>("node:crypto");
  return {
    ...actual,
    randomBytes: vi.fn((...args: Parameters<typeof actual.randomBytes>) => (actual.randomBytes as unknown as (...a: any[]) => any)(...args)),
  };
});

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    mkdirSync: vi.fn(actual.mkdirSync),
    writeFileSync: vi.fn(actual.writeFileSync),
    readFileSync: vi.fn(actual.readFileSync),
    rmSync: vi.fn(actual.rmSync),
    unlinkSync: vi.fn(actual.unlinkSync),
  };
});

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { join, dirname } from "node:path";
import {
  OtelTracingProvider,
  NoopTracingProvider,
  ParentBasedSampler,
  createTracingProvider,
  tracesPath,
  validateParentChain,
  TRACE_ID_RE,
  SPAN_ID_RE,
  INVALID_TRACE_ID,
  INVALID_SPAN_ID,
  isValidTraceId,
  isValidSpanId,
  assertTraceId,
  assertSpanId,
  defaultTracingProvider,
} from "../packages/observability/otel-provider.js";
import type { TraceId, SpanId, TraceContext, SpanContext } from "../src/domain/tracing.js";

const mockedRandomBytes = vi.mocked(crypto.randomBytes);
const mockedExistsSync = vi.mocked(fs.existsSync);
const mockedMkdirSync = vi.mocked(fs.mkdirSync);
const mockedWriteFileSync = vi.mocked(fs.writeFileSync);
const mockedReadFileSync = vi.mocked(fs.readFileSync);

function validTraceId(): TraceId {
  return crypto.randomBytes(16).toString("hex") as TraceId;
}
function validSpanId(): SpanId {
  return crypto.randomBytes(8).toString("hex") as SpanId;
}

describe("observability/otel-provider — 95% coverage", () => {
  const tracesDir = join(process.cwd(), "behavior-os", "runtime", "traces");
  let actualFs: typeof import("node:fs");

  beforeAll(async () => {
    actualFs = await vi.importActual<typeof import("node:fs")>("node:fs");
    // ensure traces dir exists for real
    mockedMkdirSync.mockImplementation(actualFs.mkdirSync as any);
    mockedWriteFileSync.mockImplementation(actualFs.writeFileSync as any);
    mockedExistsSync.mockImplementation(actualFs.existsSync as any);
    mockedReadFileSync.mockImplementation(actualFs.readFileSync as any);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // restore delegating impls after clear (clear keeps impl, but ensure)
    mockedRandomBytes.mockImplementation((...args: any[]) => (actualFs as any) && (actualFs as any) || (crypto as any).randomBytes ? (actualFs as any) : undefined); // placeholder will be reset below
    // Re-establish actual delegations explicitly via importActual's actuals
    mockedRandomBytes.mockImplementation(((size: number) => {
      // use actual randomBytes from imported actual (we captured via importActual inside mock, but we have actualFs for fs; for crypto use real)
      // we need real crypto randomBytes — get via vi.importActual sync not possible, so call actual implementation via original
      // The mock was created with actual.randomBytes, after clear it still delegates, so we can just restore by not overriding.
      // So we reset to undefined and let Vitest keep original impl? Actually clearAllMocks keeps impl, so we don't need to set.
      // To be safe, we call mockedRandomBytes.mockReset and then re-mock to actual
      return (actualFs as any); // dummy to avoid TS error, will be overridden immediately below
    }) as any);
    // Simpler: restore by re-importing actual crypto's randomBytes via vi.importActual async not available sync.
    // Instead we just ensure after clearAllMocks we don't have overridden impl — the mock still has original impl from vi.mock factory.
    // So we don't need to set anything. But we overrode above with dummy, so undo:
    mockedRandomBytes.mockRestore?.();
    // After restore, we lose mock; re-apply mock to delegate to real
    // Instead we re-create mock implementation by getting actual via dynamic import inside beforeEach async not possible sync.
    // Workaround: use vi.spyOn style — we will just make mockedRandomBytes call real crypto.randomBytes via node:crypto actual captured through `actualFs` not, so capture real via require
    // Use global real: import * as realCrypto from "node:crypto" actual via vi.importActual is async, but we can capture it in beforeAll via variable
  });

  // helper to reset fs mocks to real delegating
  async function resetFsToReal() {
    const real = await vi.importActual<typeof import("node:fs")>("node:fs");
    mockedExistsSync.mockImplementation(real.existsSync as any);
    mockedMkdirSync.mockImplementation(real.mkdirSync as any);
    mockedWriteFileSync.mockImplementation(real.writeFileSync as any);
    mockedReadFileSync.mockImplementation(real.readFileSync as any);
    // crypto
    const realCrypto = await vi.importActual<typeof import("node:crypto")>("node:crypto");
    mockedRandomBytes.mockImplementation((...args: any[]) => (realCrypto.randomBytes as any)(...args));
  }

  beforeEach(async () => {
    await resetFsToReal();
    // clean traces between tests via real fs — preserva .gitkeep (arquivos escondidos não são removidos por rmSync de conteúdos listados)
    const real = await vi.importActual<typeof import("node:fs")>("node:fs");
    try {
      for (const f of real.readdirSync(tracesDir)) {
        if (f !== ".gitkeep") real.rmSync(join(tracesDir, f), { recursive: true, force: true });
      }
    } catch {}
  });

  afterEach(async () => {
    await resetFsToReal();
    vi.restoreAllMocks();
    // re-apply mocks after restoreAllMocks: need to re-mock because restoreAllMocks removed spy impl
    // re-establish via resetFsToReal again on next beforeEach, so okay
    // clean traces — preserva .gitkeep
    const real = await vi.importActual<typeof import("node:fs")>("node:fs");
    try {
      for (const f of real.readdirSync(tracesDir)) {
        if (f !== ".gitkeep") real.rmSync(join(tracesDir, f), { recursive: true, force: true });
      }
    } catch {}
    delete process.env.OTEL_SDK_DISABLED;
  });

  describe("helpers and regex", () => {
    it("exports W3C regex and validators", () => {
      expect(TRACE_ID_RE.test("a".repeat(32))).toBe(true);
      expect(SPAN_ID_RE.test("b".repeat(16))).toBe(true);
      expect(isValidTraceId(INVALID_TRACE_ID)).toBe(false);
      expect(isValidSpanId(INVALID_SPAN_ID)).toBe(false);
      expect(isValidTraceId("a".repeat(32))).toBe(true);
      expect(isValidSpanId("b".repeat(16))).toBe(true);
      expect(() => assertTraceId(INVALID_TRACE_ID)).toThrow();
      expect(() => assertSpanId(INVALID_SPAN_ID)).toThrow();
      expect(() => assertTraceId("abc")).toThrow();
      expect(() => assertSpanId("abc")).toThrow();
      expect(tracesPath("m1")).toBe(join(process.cwd(), "behavior-os", "runtime", "traces", "m1.json"));
    });

    it("generateTraceId loop handles INVALID via mocked randomBytes", async () => {
      const realCrypto = await vi.importActual<typeof import("node:crypto")>("node:crypto");
      // First call returns INVALID (16 zero bytes), second returns valid
      mockedRandomBytes
        .mockImplementationOnce(() => Buffer.alloc(16, 0) as any)
        .mockImplementationOnce(() => Buffer.from("aabbccddeeff00112233445566778899", "hex") as any)
        .mockImplementation((size: number) => (realCrypto.randomBytes as any)(size));
      const p = new OtelTracingProvider({ ratio: 1, parentBased: false });
      const span = p.startSpan("mission:invalid-loop", { parentSpan: null });
      expect(isValidTraceId(span.spanContext.traceId)).toBe(true);
      expect(span.spanContext.traceId).not.toBe(INVALID_TRACE_ID);
      // also test generateSpanId loop with 8 zero bytes
      mockedRandomBytes
        .mockImplementationOnce(() => Buffer.alloc(8, 0) as any)
        .mockImplementationOnce(() => Buffer.from("aabbccddeeff0011", "hex") as any)
        .mockImplementation((size: number) => (realCrypto.randomBytes as any)(size));
      const span2 = p.startSpan("stage:second", { parentSpan: span.spanContext });
      expect(isValidSpanId(span2.spanContext.spanId)).toBe(true);
      expect(span2.spanContext.spanId).not.toBe(INVALID_SPAN_ID);
    });
  });

  describe("ParentBasedSampler", () => {
    it("parentBased sampled and not-sampled", () => {
      const sampler = new ParentBasedSampler({ ratio: 1, parentBased: true });
      const parentSampled: SpanContext = { traceId: "a".repeat(32), spanId: "b".repeat(16), traceFlags: 1 };
      const parentNot: SpanContext = { traceId: "a".repeat(32), spanId: "b".repeat(16), traceFlags: 0 };
      expect(sampler.shouldSample(null, "a".repeat(32) as TraceId, "any", parentSampled).sampled).toBe(true);
      expect(sampler.shouldSample(null, "a".repeat(32) as TraceId, "any", parentSampled).reason).toBe("parentBased-sampled");
      expect(sampler.shouldSample(null, "a".repeat(32) as TraceId, "any", parentNot).sampled).toBe(false);
      expect(sampler.shouldSample(null, "a".repeat(32) as TraceId, "any", parentNot).reason).toBe("parentBased-not-sampled");
    });

    it("rules with * regex, | regex and substring", () => {
      const sampler = new ParentBasedSampler({
        ratio: 0,
        parentBased: false,
        rules: [
          { spanNamePattern: "security*", ratio: 1 },
          { spanNamePattern: "xyz|qqq", ratio: 1 },
          { spanNamePattern: "plain", ratio: 0 },
        ],
      });
      // security* should be treated as regex
      const r1 = sampler.shouldSample(null, "a".repeat(32) as TraceId, "security-audit-stage", null);
      expect(r1.sampled).toBe(true);
      expect(r1.reason).toContain("rule:security*");
      // xyz|qqq pattern — should match xyz
      const r2 = sampler.shouldSample(null, "a".repeat(32) as TraceId, "has-xyz-here", null);
      expect(r2.sampled).toBe(true);
      // also matches qqq
      const r2b = sampler.shouldSample(null, "a".repeat(32) as TraceId, "has-qqq-here", null);
      expect(r2b.sampled).toBe(true);
      // plain substring with ratio 0 => not sampled (ensure first two not match)
      const r3 = sampler.shouldSample(null, "a".repeat(32) as TraceId, "my-plain-span", null);
      // "my-plain-span" contains "plain" so matches third rule
      expect(r3.sampled).toBe(false);
      expect(r3.reason).toContain("rule:plain-not-sampled");
    });

    it("rule with invalid regex falls back to includes", () => {
      const sampler = new ParentBasedSampler({
        ratio: 0,
        parentBased: false,
        rules: [{ spanNamePattern: "[invalid", ratio: 1 }],
      });
      const r = sampler.shouldSample(null, "a".repeat(32) as TraceId, "[invalid-span", null);
      expect(r.sampled).toBe(true);
      // also test when pattern invalid but includes fails -> go to next rule or ratio
      const r2 = sampler.shouldSample(null, "a".repeat(32) as TraceId, "other", null);
      // "[invalid" not includes "other", so should fall through to ratio 0 => not sampled
      expect(r2.sampled).toBe(false);
    });

    it("ratio branch sampled true/false via Math.random mock", () => {
      const sampler = new ParentBasedSampler({ ratio: 0.5, parentBased: false });
      const orig = Math.random;
      try {
        (Math as any).random = () => 0.1;
        expect(sampler.shouldSample(null, "a".repeat(32) as TraceId, "span", null).sampled).toBe(true);
        (Math as any).random = () => 0.9;
        expect(sampler.shouldSample(null, "a".repeat(32) as TraceId, "span", null).sampled).toBe(false);
        expect(sampler.shouldSample(null, "a".repeat(32) as TraceId, "span", null).reason).toBe("ratio-not-sampled");
      } finally {
        (Math as any).random = orig;
      }
    });

    it("sampler error fallback when Math.random throws", () => {
      const sampler = new ParentBasedSampler({ ratio: 0.5, parentBased: false, rules: [{ spanNamePattern: "x", ratio: 0.5 }] });
      const orig = Math.random;
      try {
        (Math as any).random = () => { throw new Error("random fail"); };
        const r = sampler.shouldSample(null, "a".repeat(32) as TraceId, "x-span", null);
        expect(r.sampled).toBe(true);
        expect(r.reason).toBe("sampler-error-fallback-sampled");
        // also test error in default ratio path without rules matching
        const sampler2 = new ParentBasedSampler({ ratio: 0.5, parentBased: false });
        const r2 = sampler2.shouldSample(null, "a".repeat(32) as TraceId, "no-match", null);
        expect(r2.sampled).toBe(true);
      } finally {
        (Math as any).random = orig;
      }
    });

    it("rule ratio sampled false branch", () => {
      const sampler = new ParentBasedSampler({ ratio: 1, parentBased: false, rules: [{ spanNamePattern: "test", ratio: 0 }] });
      // Math.random always 0.5 >0 => not sampled
      const r = sampler.shouldSample(null, "a".repeat(32) as TraceId, "test-span", null);
      expect(r.sampled).toBe(false);
      expect(r.reason).toContain("not-sampled");
    });
  });

  describe("OtelSpanImpl via provider", () => {
    it("span lifecycle: setAttribute, addEvent, setStatus, end, toJSON, durationMs, getters", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const span: any = p.startSpan("mission:span-test", { parentSpan: null, attributes: { foo: "bar" } });
      span.setAttribute("extra", 123);
      span.setAttribute("flag", true);
      span.addEvent("ev1", { k: 1 });
      span.addEvent("ev2", { k: 2 }, "2024-01-01T00:00:00.000Z");
      span.setStatus("ok", "all good");
      expect(span._attributes.extra).toBe(123);
      expect(span._events.length).toBe(2);
      expect(span._events[1].time).toBe("2024-01-01T00:00:00.000Z");
      expect(span._status.code).toBe("ok");
      // duration before end is undefined
      expect(span.durationMs).toBeUndefined();
      // toJSON before end still has endTime generated
      const jsonBefore = span.toJSON();
      expect(jsonBefore.attributes.extra).toBe(123);
      expect(jsonBefore.status).toBe("ok");
      // end with explicit time (after start)
      const future = new Date(Date.now() + 10000).toISOString();
      const future2 = new Date(Date.now() + 20000).toISOString();
      span.end(future);
      expect(span._endTime).toBe(future);
      expect(span.durationMs).toBeGreaterThan(0);
      // second end is no-op
      span.end(future2);
      expect(span._endTime).toBe(future);
      // toJSON after end
      const json = span.toJSON();
      expect(json.endTime).toBe(future);
      expect(json.spanId).toBe(span.spanContext.spanId);
      // setStatus error
      span.setStatus("error", "fail");
      expect(span._status.code).toBe("error");
      // end without args uses Date.now
      const p2 = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const s2: any = p2.startSpan("stage:no-end", { parentSpan: null });
      s2.end();
      expect(s2._endTime).toBeDefined();
    });

    it("span toJSON without attributes and with parentSpanId null", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const s: any = p.startSpan("mission:root", { parentSpan: null });
      const j = s.toJSON();
      expect(j.parentSpanId).toBeNull();
      expect(j.traceFlags).toBe(1);
    });
  });

  describe("OtelTracingProvider constructor and startSpan", () => {
    it("clamps ratio 0..1", () => {
      const pLow = new OtelTracingProvider({ ratio: -0.5, parentBased: true });
      expect((pLow as any).samplingConfig.ratio).toBe(0);
      const pHigh = new OtelTracingProvider({ ratio: 2, parentBased: true });
      expect((pHigh as any).samplingConfig.ratio).toBe(1);
      const pDefault = new OtelTracingProvider();
      expect((pDefault as any).samplingConfig.ratio).toBe(1);
    });

    it("throws when shutdown", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      await p.shutdown();
      expect(() => p.startSpan("test")).toThrow("TracingProvider shutdown");
    });

    it("startSpan with parentSpan inherits traceId", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const root = p.startSpan("mission:parent-test", { parentSpan: null });
      const child = p.startSpan("stage:child", { parentSpan: root.spanContext });
      expect(child.spanContext.traceId).toBe(root.spanContext.traceId);
      expect(child.parentSpanId).toBe(root.spanContext.spanId);
    });

    it("startSpan with activeContext inherits when parentSpan undefined", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const root = p.startSpan("mission:active", { parentSpan: null });
      // root promoted to activeContext
      expect(p.getActiveContext()?.traceId).toBe(root.spanContext.traceId);
      // child without parentSpan option (undefined) should inherit activeContext traceId and spanId
      const child = p.startSpan("stage:inherited", {});
      expect(child.spanContext.traceId).toBe(root.spanContext.traceId);
      expect(child.parentSpanId).toBe(root.spanContext.spanId);
    });

    it("startSpan with activeContext and explicit parentSpan null creates new trace", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const root = p.startSpan("mission:root1", { parentSpan: null });
      const newRoot = p.startSpan("mission:root2", { parentSpan: null });
      expect(newRoot.spanContext.traceId).not.toBe(root.spanContext.traceId);
      // also test branch where options contains parentSpan null explicitly with activeContext present
      const p2 = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const r1 = p2.startSpan("mission:first", { parentSpan: null });
      expect(p2.getActiveContext()).not.toBeNull();
      const r2 = p2.startSpan("stage:explicit-null", { parentSpan: null });
      expect(r2.spanContext.traceId).not.toBe(r1.spanContext.traceId);
      expect(r2.parentSpanId).toBeNull();
    });

    it("startSpan without activeContext and without parent creates new trace", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const s = p.startSpan("stage:orphan", {});
      expect(s.parentSpanId).toBeNull();
      expect(isValidTraceId(s.spanContext.traceId)).toBe(true);
    });

    it("startSpan sets sampling attributes and links.count", () => {
      const p = new OtelTracingProvider({ ratio: 0.5, parentBased: false });
      const s: any = p.startSpan("stage:links", { parentSpan: null, links: [{ traceId: "a".repeat(32) as TraceId, spanId: "b".repeat(16) as SpanId, traceFlags: 1 }] });
      expect(s._attributes["sampling.reason"]).toBeDefined();
      expect(s._attributes["sampling.ratio"]).toBe("0.5");
      expect(s._attributes["links.count"]).toBe(1);
    });

    it("traceMeta inference from mission: prefix and attributes.missionId", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      p.startSpan("mission:my-mission", { parentSpan: null });
      expect((p as any).traceMeta.get((p as any).getAllTraceIds()[0]).missionId).toBe("my-mission");
      const p2 = new OtelTracingProvider({ ratio: 1, parentBased: true });
      p2.startSpan("stage:foo", { parentSpan: null, attributes: { missionId: "attr-mission" } });
      expect((p2 as any).traceMeta.get((p2 as any).getAllTraceIds()[0]).missionId).toBe("attr-mission");
      // second span same trace should not overwrite meta
      const root = p2.getAllTraceIds()[0];
      const span = (p2 as any).spansByTrace.get(root)[0];
      p2.startSpan("stage:second", { parentSpan: span.spanContext });
      expect((p2 as any).traceMeta.get(root).missionId).toBe("attr-mission");
    });

    it("activeContext promotion only when !activeContext && parentSpan===null", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const s1 = p.startSpan("stage:not-promoted", {}); // parent undefined, no activeContext -> trace new but not promoted because parent not null explicit? Actually s1 parentSpan null? Without parent, parentSpan is null but activeContext is null, so condition is parentSpan===null true => promotes? Wait code: if (!activeContext && parentSpan===null) promote. For s1, activeContext null and parentSpan null (since no parent), so it will promote. Need test non-promoted case: start with parentSpan provided
      expect(p.getActiveContext()).not.toBeNull();
      // next span with parentSpan not null should not promote to new activeContext (already has active)
      const before = p.getActiveContext();
      p.startSpan("stage:child-with-parent", { parentSpan: s1.spanContext });
      expect(p.getActiveContext()).toBe(before);
    });
  });

  describe("getActiveContext / withContext / getActiveSpan", () => {
    it("withContext pushes and restores", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const root = p.startSpan("mission:with-test", { parentSpan: null });
      const ctx: TraceContext = { traceId: root.spanContext.traceId, spanId: root.spanContext.spanId, traceFlags: 1 };
      expect(p.getActiveContext()?.spanId).toBe(root.spanContext.spanId);
      const inner = p.withContext(ctx, () => {
        expect(p.getActiveContext()?.spanId).toBe(ctx.spanId);
        return p.getActiveContext();
      });
      expect(inner?.spanId).toBe(ctx.spanId);
      expect(p.getActiveContext()?.spanId).toBe(root.spanContext.spanId);
      // nested withContext
      const otherTrace = validTraceId();
      const otherCtx: TraceContext = { traceId: otherTrace, spanId: validSpanId(), traceFlags: 0 };
      const nested = p.withContext(otherCtx, () => p.getActiveContext());
      expect(nested?.traceId).toBe(otherTrace);
      expect(p.getActiveContext()?.traceId).toBe(root.spanContext.traceId);
    });

    it("withContext resolves activeSpan when span exists and when not", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const root: any = p.startSpan("mission:span-ctx", { parentSpan: null });
      const ctx: TraceContext = { traceId: root.spanContext.traceId, spanId: root.spanContext.spanId, traceFlags: 1 };
      let activeInside: any = null;
      p.withContext(ctx, () => {
        activeInside = (p as any).activeSpan;
      });
      expect(activeInside?.spanContext.spanId).toBe(root.spanContext.spanId);
      // non-existent spanId
      const fakeCtx: TraceContext = { traceId: root.spanContext.traceId, spanId: validSpanId(), traceFlags: 1 };
      let activeFake: any = "not-null";
      p.withContext(fakeCtx, () => {
        activeFake = (p as any).activeSpan;
      });
      expect(activeFake).toBeNull();
    });

    it("getActiveSpan returns active span", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      expect(p.getActiveSpan()).toBeNull();
      const root = p.startSpan("mission:active-span", { parentSpan: null });
      expect(p.getActiveSpan()?.spanContext.spanId).toBe(root.spanContext.spanId);
    });
  });

  describe("extract / inject", () => {
    it("extract valid and invalid headers", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const traceId = "a".repeat(32) as TraceId;
      const spanId = "b".repeat(16) as SpanId;
      // valid
      const ctx = p.extract({ traceparent: `00-${traceId}-${spanId}-01` });
      expect(ctx?.traceId).toBe(traceId);
      expect(ctx?.spanId).toBe(spanId);
      expect(ctx?.traceFlags).toBe(1);
      // case insensitive header keys
      expect(p.extract({ Traceparent: `00-${traceId}-${spanId}-00` })?.traceFlags).toBe(0);
      expect(p.extract({ traceParent: `00-${traceId}-${spanId}-01` })?.traceFlags).toBe(1);
      // trim
      expect(p.extract({ traceparent: ` 00-${traceId}-${spanId}-01 ` })?.traceId).toBe(traceId);
      // invalid format
      expect(p.extract({ traceparent: "invalid" })).toBeNull();
      expect(p.extract({})).toBeNull();
      expect(p.extract({ traceparent: 123 as any })).toBeNull();
      // invalid ids
      expect(p.extract({ traceparent: `00-${INVALID_TRACE_ID}-${spanId}-01` })).toBeNull();
      expect(p.extract({ traceparent: `00-${traceId}-${INVALID_SPAN_ID}-01` })).toBeNull();
      // invalid hex uppercase should fail (regex lower only)
      expect(p.extract({ traceparent: `00-${traceId.toUpperCase()}-${spanId}-01` })).toBeNull();
      // tracestate and baggage
      const withState = p.extract({ traceparent: `00-${traceId}-${spanId}-01`, tracestate: "rojo=00f067aa0ba902b7", baggage: "userId=123" });
      expect(withState?.traceState).toBe("rojo=00f067aa0ba902b7");
      expect(withState?.baggage).toEqual({ baggage: "userId=123" });
      expect(p.extract({ traceparent: `00-${traceId}-${spanId}-01`, Tracestate: "a=b" })?.traceState).toBe("a=b");
      // flags hex 01 vs 00 and 0x03 masked to 01?
      expect(p.extract({ traceparent: `00-${traceId}-${spanId}-03` })?.traceFlags).toBe(1); // 0x03 &0x01 =1
    });

    it("inject sets headers with flags, tracestate, baggage", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const traceId = "c".repeat(32) as TraceId;
      const spanId = "d".repeat(16) as SpanId;
      const headers: Record<string, string> = {};
      p.inject({ traceId, spanId, traceFlags: 1 }, headers);
      expect(headers.traceparent).toBe(`00-${traceId}-${spanId}-01`);
      // traceFlags 0
      const h2: Record<string, string> = {};
      p.inject({ traceId, spanId, traceFlags: 0 }, h2);
      expect(h2.traceparent).toBe(`00-${traceId}-${spanId}-00`);
      // with tracestate
      const h3: Record<string, string> = {};
      p.inject({ traceId, spanId, traceFlags: 1, traceState: "a=b" }, h3);
      expect(h3.tracestate).toBe("a=b");
      // with baggage
      const h4: Record<string, string> = {};
      p.inject({ traceId, spanId, traceFlags: 1, baggage: { user: "a b", key: "val" } as any }, h4);
      expect(h4.baggage).toContain("user=a%20b");
      expect(h4.baggage).toContain("key=val");
      // empty baggage not set
      const h5: Record<string, string> = {};
      p.inject({ traceId, spanId, traceFlags: 1, baggage: {} as any }, h5);
      expect(h5.baggage).toBeUndefined();
      // invalid ids throw
      expect(() => p.inject({ traceId: INVALID_TRACE_ID as TraceId, spanId, traceFlags: 1 }, {} as any)).toThrow();
      expect(() => p.inject({ traceId, spanId: INVALID_SPAN_ID as SpanId, traceFlags: 1 }, {} as any)).toThrow();
    });
  });

  describe("buildTraceFile / persist / toEvidenceTraces", () => {
    it("buildTraceFile returns null when no spans", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const file = (p as any).buildTraceFile("m1", "a".repeat(32) as TraceId);
      expect(file).toBeNull();
    });

    it("persist with traceIdOverride writes file", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const root = p.startSpan("mission:persist-override", { parentSpan: null });
      const child: any = p.startSpan("stage:child", { parentSpan: root.spanContext });
      child.end();
      (root as any).end();
      const out = await p.persist("persist-override", root.spanContext.traceId);
      expect(out).not.toBeNull();
      expect(actualFs.existsSync(out!)).toBe(true);
      const data = JSON.parse(actualFs.readFileSync(out!, "utf-8"));
      expect(data.missionId).toBe("persist-override");
      expect(data.traceId).toBe(root.spanContext.traceId);
      expect(data.spans.length).toBe(2);
      expect(data.sampling.ratio).toBe(1);
    });

    it("persist finds via meta missionId", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      p.startSpan("mission:meta-mission", { parentSpan: null });
      const out = await p.persist("meta-mission");
      expect(out).not.toBeNull();
      expect(out).toBe(tracesPath("meta-mission"));
    });

    it("persist fallback single trace when only one trace", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const s = p.startSpan("stage:single", { parentSpan: null });
      // remove meta to force fallback single trace path? traceMeta has missionId undefined for stage:single? Actually stage:single will have missionId undefined, so first loop won't find, but size===1 will trigger
      const out = await p.persist("single-fallback");
      expect(out).not.toBeNull();
      const data = JSON.parse(actualFs.readFileSync(out!, "utf-8"));
      expect(data.spans[0].traceId).toBe(s.spanContext.traceId);
    });

    it("persist fallback hasMission via span name", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const root: any = p.startSpan("mission:has-mission-fb", { parentSpan: null });
      // clear traceMeta to force hasMission loop
      (p as any).traceMeta.clear();
      const out = await p.persist("has-mission-fb");
      expect(out).not.toBeNull();
      // also test hasMission via attribute missionId
      const p2 = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const r2: any = p2.startSpan("stage:attr", { parentSpan: null, attributes: { missionId: "attr-mission-fb" } });
      (p2 as any).traceMeta.clear();
      // need to set _attributes directly? already set via attributes
      const out2 = await p2.persist("attr-mission-fb");
      expect(out2).not.toBeNull();
    });

    it("persist returns null when no trace found", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      expect(await p.persist("nope")).toBeNull();
      // with override non-existing
      expect(await p.persist("nope", "a".repeat(32) as TraceId)).toBeNull();
    });

    it("persist returns null when buildTraceFile null due to empty spans for traceId", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const s = p.startSpan("mission:empty-build", { parentSpan: null });
      // inject fake traceMeta without spans
      (p as any).traceMeta.set("f".repeat(32) as TraceId, { missionId: "fake", sampling: { sampled: true, reason: "test" }, ratio: 1 });
      // persist fake should return null because spans empty
      expect(await p.persist("fake", "f".repeat(32) as TraceId)).toBeNull();
    });

    it("toEvidenceTraces returns snapshot with exists, sampled, parentSpanId", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const root = p.startSpan("mission:ev-test", { parentSpan: null });
      // without persist, exists false
      const snap1 = p.toEvidenceTraces("ev-test");
      expect(snap1?.exists).toBe(false);
      expect(snap1?.sampled).toBe(true);
      expect(snap1?.parentSpanId).toBeNull();
      expect(snap1?.spanCount).toBe(1);
      // persist then exists true
      await p.persist("ev-test");
      const snap2 = p.toEvidenceTraces("ev-test");
      expect(snap2?.exists).toBe(true);
      // with override
      const snap3 = p.toEvidenceTraces("ev-test", root.spanContext.traceId);
      expect(snap3?.traceId).toBe(root.spanContext.traceId);
      // not found returns null when empty provider
      const emptyP = new OtelTracingProvider({ ratio: 1, parentBased: true });
      expect(emptyP.toEvidenceTraces("unknown")).toBeNull();
      // also null when multiple traces but no match and size !=1
      const pMany = new OtelTracingProvider({ ratio: 1, parentBased: true });
      pMany.startSpan("mission:many1", { parentSpan: null });
      pMany.startSpan("mission:many2", { parentSpan: null });
      expect(pMany.toEvidenceTraces("unknown")).toBeNull();
      // fallback single trace
      const p2 = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const s = p2.startSpan("stage:single-ev", { parentSpan: null });
      // clear meta to test fallback single
      (p2 as any).traceMeta.clear();
      // need to have spansByTrace size 1, toEvidence should fallback to first traceId when no meta match
      // but our p2 has no meta, so it goes to if (!traceId && size===1) branch
      // To test single fallback, we need to not have meta, so clearing is correct. However toEvidence also checks meta loop first, then size===1
      // It should return snapshot even without meta, with traceId = first key
      const snapSingle = p2.toEvidenceTraces("whatever");
      // Since size===1, it will return traceId of s even though missionId mismatched? Actually code second check: if (!traceId && size===1) traceId = first
      // So it will return not null even for unknown missionId, but with file = tracesPath(missionId) which is not related to trace.
      // For unknown missionId "whatever", it will still return snapshot with spanCount 1
      expect(snapSingle).not.toBeNull();
      // sampled false case
      const p3 = new OtelTracingProvider({ ratio: 0, parentBased: false });
      const r3 = p3.startSpan("mission:sampled-false", { parentSpan: null });
      expect(r3.spanContext.traceFlags).toBe(0);
      const snapFalse = p3.toEvidenceTraces("sampled-false");
      expect(snapFalse?.sampled).toBe(false);
    });

    it("getSpans and getAllTraceIds", () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const r1 = p.startSpan("mission:g1", { parentSpan: null });
      const r2 = p.startSpan("mission:g2", { parentSpan: null });
      expect(p.getAllTraceIds().length).toBe(2);
      expect(p.getSpans(r1.spanContext.traceId).length).toBe(1);
      expect(p.getSpans("f".repeat(32) as TraceId)).toEqual([]);
    });

    it("flush persists all with missionId", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      p.startSpan("mission:flush1", { parentSpan: null });
      p.startSpan("mission:flush2", { parentSpan: null });
      await p.flush();
      expect(actualFs.existsSync(tracesPath("flush1"))).toBe(true);
      expect(actualFs.existsSync(tracesPath("flush2"))).toBe(true);
      // flush with no missionId should not persist
      const p2 = new OtelTracingProvider({ ratio: 1, parentBased: true });
      p2.startSpan("stage:no-mission", { parentSpan: null });
      await p2.flush();
      expect(actualFs.existsSync(tracesPath("no-mission"))).toBe(false);
    });

    it("shutdown flushes and sets flag and clears bridge", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const s = p.startSpan("mission:shutdown", { parentSpan: null });
      await p.shutdown();
      // after shutdown, startSpan throws
      expect(() => p.startSpan("stage:after")).toThrow();
      // shutdown is idempotent? second shutdown should still work without throwing
      await expect(p.shutdown()).resolves.not.toThrow();
    });
  });

  describe("NoopTracingProvider", () => {
    it("covers all Noop methods", async () => {
      process.env.OTEL_SDK_DISABLED = "true";
      const noop = createTracingProvider() as NoopTracingProvider;
      expect(noop.name).toBe("otel");
      const parent: SpanContext = { traceId: "a".repeat(32) as TraceId, spanId: "b".repeat(16) as SpanId, traceFlags: 1 };
      const span = noop.startSpan("test", { parentSpan: parent });
      expect(span.spanContext.traceId).toBe(parent.traceId);
      expect(span.parentSpanId).toBe(parent.spanId);
      const span2 = noop.startSpan("test2");
      expect(isValidTraceId(span2.spanContext.traceId)).toBe(true);
      expect(span2.spanContext.traceFlags).toBe(0);
      span.setAttribute("k", "v");
      span.addEvent("e");
      span.setStatus("ok");
      span.end();
      expect(noop.getActiveContext()).toBeNull();
      const ctx: TraceContext = { traceId: "a".repeat(32) as TraceId, spanId: "b".repeat(16) as SpanId, traceFlags: 1 };
      const res = noop.withContext(ctx, () => 42);
      expect(res).toBe(42);
      expect(noop.extract({} as any)).toBeNull();
      noop.inject({} as any, {} as any);
      await noop.flush();
      await noop.shutdown();
      expect(await noop.persist()).toBeNull();
      expect(noop.toEvidenceTraces()).toBeNull();
      delete process.env.OTEL_SDK_DISABLED;
    });

    it("NoopSpan constructor via direct", () => {
      const n = new NoopTracingProvider();
      const s: any = n.startSpan("x", { parentSpan: null });
      expect(s.parentSpanId).toBeNull();
    });
  });

  describe("createTracingProvider factory", () => {
    it("creates Otel when not disabled and Noop when disabled", () => {
      delete process.env.OTEL_SDK_DISABLED;
      const p = createTracingProvider({ ratio: 1, parentBased: true });
      expect(p.name).toBe("otel");
      expect((p as any).startSpan).toBeDefined();
      process.env.OTEL_SDK_DISABLED = "true";
      const n = createTracingProvider();
      expect(n instanceof NoopTracingProvider).toBe(true);
      delete process.env.OTEL_SDK_DISABLED;
      expect(defaultTracingProvider).toBeDefined();
      expect(defaultTracingProvider.name).toBe("otel");
    });
  });

  describe("validateParentChain", () => {
    it("empty", () => {
      expect(validateParentChain([]).valid).toBe(false);
      expect(validateParentChain([]).reason).toBe("empty spans");
    });
    it("single root valid", () => {
      const id = validSpanId();
      expect(validateParentChain([{ spanId: id, parentSpanId: null }]).valid).toBe(true);
    });
    it("multiple roots invalid", () => {
      const a = validSpanId();
      const b = validSpanId();
      expect(validateParentChain([{ spanId: a, parentSpanId: null }, { spanId: b, parentSpanId: null }].sort(() => 0)).valid).toBe(false);
    });
    it("orphan", () => {
      const root = validSpanId();
      const child = validSpanId();
      const orphanParent = validSpanId(); // not in map
      expect(validateParentChain([{ spanId: root, parentSpanId: null }, { spanId: child, parentSpanId: orphanParent }]).valid).toBe(false);
    });
    it("valid chain mission->stage->tool", () => {
      const root = validSpanId();
      const stage = validSpanId();
      const tool = validSpanId();
      const res = validateParentChain([
        { spanId: root, parentSpanId: null },
        { spanId: stage, parentSpanId: root },
        { spanId: tool, parentSpanId: stage },
      ]);
      expect(res.valid).toBe(true);
    });
    it("orphan where parent equals root id but not in map handled", () => {
      const root = validSpanId();
      const child = validSpanId();
      // child parent is root, which is in map, so valid
      expect(validateParentChain([{ spanId: root, parentSpanId: null }, { spanId: child, parentSpanId: root }]).valid).toBe(true);
    });
  });

  describe("additional branch coverage", () => {
    it("covers remaining lines: links undefined, durationMs, getters, buildTraceFile root fallback", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const root: any = p.startSpan("stage:root-no-links", { parentSpan: null });
      // ensure no links -> attribute not set
      expect(root._attributes["links.count"]).toBeUndefined();
      // test durationMs undefined -> already tested, but also test after end with undefined endTime fallback in toJSON
      const p2 = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const s2: any = p2.startSpan("mission:dur", { parentSpan: null });
      // call toJSON before end => endTime is generated via fallback
      const j = s2.toJSON();
      expect(j.endTime).toBeDefined();
      // test getters
      expect(s2._events).toBeDefined();
      expect(s2._attributes).toBeDefined();
      expect(s2._endTime).toBeUndefined();
      expect(s2._status.code).toBe("unset");
      // buildTraceFile with no root parent null? create a trace where root has parent not null? But root always null. Test fallback root = spans[0]
      const p3 = new OtelTracingProvider({ ratio: 1, parentBased: true });
      const fakeSpan: any = {
        spanContext: { traceId: "a".repeat(32), spanId: "b".repeat(16), traceFlags: 1 },
        parentSpanId: "c".repeat(16),
        name: "stage:fake",
        startTime: new Date().toISOString(),
        toJSON: () => ({ spanId: "b".repeat(16), parentSpanId: "c".repeat(16), traceId: "a".repeat(32), name: "stage:fake", startTime: new Date().toISOString(), endTime: new Date().toISOString(), attributes: {}, events: [], status: "ok", traceFlags: 1 }),
      };
      (p3 as any).spansByTrace.set("a".repeat(32) as TraceId, [fakeSpan]);
      (p3 as any).traceMeta.set("a".repeat(32) as TraceId, { missionId: "m", sampling: { sampled: true, reason: "test" }, ratio: 1 });
      const file = (p3 as any).buildTraceFile("m", "a".repeat(32) as TraceId);
      expect(file.parentSpanId).toBe("c".repeat(16)); // since no root null, uses spans[0]
      expect(file.sampling.reason).toBe("test");
      // also test buildTraceFile with no meta
      const p4 = new OtelTracingProvider({ ratio: 0.7, parentBased: true });
      const s4 = p4.startSpan("stage:meta-missing", { parentSpan: null });
      (p4 as any).traceMeta.delete(s4.spanContext.traceId);
      const file2 = (p4 as any).buildTraceFile("m2", s4.spanContext.traceId);
      expect(file2.sampling.ratio).toBe(0.7);
      expect(file2.sampling.reason).toBe("unknown");
    });

    it("covers persist with traceId from spans hasMission with attribute missionId", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      // stage with attribute missionId but name not mission:
      const s: any = p.startSpan("stage:attr-mission", { parentSpan: null, attributes: { missionId: "target-mission" } });
      // clear meta to force loop that checks _attributes?.missionId
      (p as any).traceMeta.clear();
      const out = await p.persist("target-mission");
      expect(out).not.toBeNull();
    });

    it("covers toEvidenceTraces with empty spans sampled false and parentSpanId logic", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      // no spans => toEvidenceTraces null already tested
      // with spans but no root (orphan case) => parentSpanId from first span's parentSpanId
      const traceId = "a".repeat(32) as TraceId;
      const fake: any = {
        spanContext: { traceId, spanId: "b".repeat(16) as SpanId, traceFlags: 0 },
        parentSpanId: "c".repeat(16) as SpanId,
        name: "stage:orphan",
      };
      (p as any).spansByTrace.set(traceId, [fake]);
      (p as any).traceMeta.set(traceId, { missionId: "m-orphan", sampling: { sampled: false, reason: "ratio" }, ratio: 0 });
      const snap = p.toEvidenceTraces("m-orphan");
      expect(snap?.sampled).toBe(false);
      expect(snap?.parentSpanId).toBe("c".repeat(16));
      expect(snap?.spanCount).toBe(1);
    });
  });
});
