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
import { join } from "node:path";
import {
  tracingProvider,
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
  startTrace,
  startMissionTrace,
  endTrace,
  getTraces,
  getActiveContext,
  withContext,
  extract,
  inject,
  persistTraces,
  toEvidenceTraces,
  flush,
  shutdown,
  generateTraceId,
  _resetForTests,
  default as defaultExport,
} from "../packages/observability/tracing.js";
import { defaultTracingProvider, OtelTracingProvider } from "../packages/observability/otel-provider.js";
import type { TraceId, SpanId, TraceContext, SpanContext } from "../src/domain/tracing.js";

const mockedRandomBytes = vi.mocked(crypto.randomBytes);
const mockedExistsSync = vi.mocked(fs.existsSync);
const mockedMkdirSync = vi.mocked(fs.mkdirSync);
const mockedWriteFileSync = vi.mocked(fs.writeFileSync);
const mockedReadFileSync = vi.mocked(fs.readFileSync);

describe("observability/tracing — 95% coverage", () => {
  const tracesDir = join(process.cwd(), "behavior-os", "runtime", "traces");
  let actualFs: typeof import("node:fs");

  beforeAll(async () => {
    actualFs = await vi.importActual<typeof import("node:fs")>("node:fs");
    mockedMkdirSync.mockImplementation(actualFs.mkdirSync as any);
    mockedWriteFileSync.mockImplementation(actualFs.writeFileSync as any);
    mockedExistsSync.mockImplementation(actualFs.existsSync as any);
    mockedReadFileSync.mockImplementation(actualFs.readFileSync as any);
  });

  async function resetFsToReal() {
    const real = await vi.importActual<typeof import("node:fs")>("node:fs");
    mockedExistsSync.mockImplementation(real.existsSync as any);
    mockedMkdirSync.mockImplementation(real.mkdirSync as any);
    mockedWriteFileSync.mockImplementation(real.writeFileSync as any);
    mockedReadFileSync.mockImplementation(real.readFileSync as any);
    const realCrypto = await vi.importActual<typeof import("node:crypto")>("node:crypto");
    mockedRandomBytes.mockImplementation((...args: any[]) => (realCrypto.randomBytes as any)(...args));
  }

  beforeEach(async () => {
    await resetFsToReal();
    _resetForTests();
  });

  afterEach(async () => {
    await resetFsToReal();
    _resetForTests();
    delete process.env.OTEL_SDK_DISABLED;
  });

  describe("re-exports and singleton", () => {
    it("re-exports W3C helpers and singletons", () => {
      expect(TRACE_ID_RE.test("a".repeat(32))).toBe(true);
      expect(SPAN_ID_RE.test("b".repeat(16))).toBe(true);
      expect(INVALID_TRACE_ID).toBe("00000000000000000000000000000000");
      expect(INVALID_SPAN_ID).toBe("0000000000000000000000".slice(0, 16));
      expect(isValidTraceId(INVALID_TRACE_ID)).toBe(false);
      expect(isValidSpanId(INVALID_SPAN_ID)).toBe(false);
      expect(() => assertTraceId(INVALID_TRACE_ID)).toThrow();
      expect(() => assertSpanId(INVALID_SPAN_ID)).toThrow();
      expect(tracesPath("m1")).toBe(join(process.cwd(), "behavior-os", "runtime", "traces", "m1.json"));
      expect(typeof validateParentChain).toBe("function");
      expect(typeof createTracingProvider).toBe("function");
      // singleton identity
      expect(tracingProvider).toBe(defaultTracingProvider);
      expect(defaultExport).toBe(tracingProvider);
      expect(tracingProvider.name).toBe("otel");
    });

    it("validateParentChain via re-export", () => {
      expect(validateParentChain([]).valid).toBe(false);
      const a = crypto.randomBytes(8).toString("hex") as SpanId;
      expect(validateParentChain([{ spanId: a, parentSpanId: null }]).valid).toBe(true);
    });
  });

  describe("generateTraceId", () => {
    it("generates valid W3C traceId", () => {
      const id = generateTraceId();
      expect(isValidTraceId(id)).toBe(true);
    });

    it("loops when randomBytes returns INVALID_TRACE_ID", async () => {
      const realCrypto = await vi.importActual<typeof import("node:crypto")>("node:crypto");
      mockedRandomBytes
        .mockImplementationOnce(() => Buffer.alloc(16, 0) as any)
        .mockImplementationOnce(() => Buffer.from("aabbccddeeff00112233445566778899", "hex") as any)
        .mockImplementation((size: number) => (realCrypto.randomBytes as any)(size));
      const id = generateTraceId();
      expect(id).toBe("aabbccddeeff00112233445566778899");
      expect(isValidTraceId(id)).toBe(true);
    });
  });

  describe("spanToTraceSpan via getTraces", () => {
    it("converts mission root and stage spans with attributes", async () => {
      const mission = startMissionTrace("mission-convert", "workflow-1", { extra: "val" });
      expect(isValidTraceId(mission.traceId)).toBe(true);
      const stageId = startTrace("discover", "researcher");
      // Also create stage with explicit parentSpan
      const ctx: SpanContext = mission.span.spanContext;
      const childId = startTrace("plan", "planner", ctx);
      // end all
      endTrace(childId);
      endTrace(stageId);
      // keep mission open for getTraces sorting test
      const traces = getTraces();
      expect(traces.length).toBeGreaterThanOrEqual(3);
      // find mission root
      const missionSpan = traces.find((t) => t.name === "mission:mission-convert");
      expect(missionSpan).toBeDefined();
      expect(missionSpan!.stage).toBe("mission-convert");
      expect(missionSpan!.agent).toBe("workflow-1");
      expect(missionSpan!.attributes?.missionId).toBe("mission-convert");
      expect(missionSpan!.attributes?.extra).toBe("val");
      // stage span
      const disc = traces.find((t) => t.name === "stage:discover");
      expect(disc).toBeDefined();
      expect(disc!.stage).toBe("discover");
      expect(disc!.agent).toBe("researcher");
      expect(disc!.parentSpanId).toBe(mission.spanId);
      // plan stage with parent explicit
      const plan = traces.find((t) => t.name === "stage:plan");
      expect(plan!.parentSpanId).toBe(mission.spanId);
      // status default ok
      expect(missionSpan!.status).toBe("ok");
      // duration maybe undefined or defined due to toJSON fallback endTime — accept both but check status ok
      expect(["ok", "error"]).toContain(missionSpan!.status);
      // duration defined for ended child
      expect(plan!.end).toBeDefined();
      expect(plan!.durationMs).toBeGreaterThanOrEqual(0);
      // sorted by start
      for (let i = 1; i < traces.length; i++) {
        expect(new Date(traces[i].start).getTime()).toBeGreaterThanOrEqual(new Date(traces[i - 1].start).getTime());
      }
    });

    it("handles stage without attributes and mission without workflowId", () => {
      startMissionTrace("m-no-workflow");
      const traces = getTraces();
      const m = traces.find((t) => t.name === "mission:m-no-workflow");
      expect(m).toBeDefined();
      expect(m!.agent).toBe("unknown");
    });

    it("handles span with error status and workflowId fallback", () => {
      const { span } = startMissionTrace("err-mission");
      // create error stage via provider directly to set status error before getTraces
      const prov: any = tracingProvider as any;
      const child = prov.startSpan("stage:error-stage", { parentSpan: span.spanContext }) as any;
      child.setStatus("error");
      child.end();
      const traces = getTraces();
      const err = traces.find((t) => t.name === "stage:error-stage");
      expect(err!.status).toBe("error");
    });

    it("handles toJSON vs plain object and missing fields in spanToTraceSpan", () => {
      // inject fake span without toJSON, with missing attributes/name/startTime
      const prov: any = tracingProvider as any;
      const fakeTraceId = crypto.randomBytes(16).toString("hex") as TraceId;
      const fakeSpanId = crypto.randomBytes(8).toString("hex") as SpanId;
      // create a span-like plain object without toJSON, inserted via spansByTrace manipulation
      const plainSpan: any = {
        spanContext: { traceId: fakeTraceId, spanId: fakeSpanId, traceFlags: 1 },
        parentSpanId: null,
        name: "stage:plain",
        // no toJSON, but has fields directly
        attributes: { agent: "tester", stage: "custom-stage" },
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 5000).toISOString(),
        status: "ok",
        traceId: fakeTraceId,
        spanId: fakeSpanId,
      };
      // Need to make provider return this via getSpans: we can push plain object onto existing trace or new trace
      const anyProv = prov as any;
      if (!anyProv.spansByTrace) anyProv.spansByTrace = new Map();
      // create new trace entry with plainSpan that has toJSON? Make it plain without toJSON, but getTraces will call spanToTraceSpan which checks typeof sp.toJSON
      // We'll manually ensure plainSpan has no toJSON
      const tid = fakeTraceId as TraceId;
      anyProv.spansByTrace.set(tid, [plainSpan]);
      if (anyProv.traceMeta) anyProv.traceMeta.set(tid, { missionId: "plain-mission", sampling: { sampled: true, reason: "test" }, ratio: 1 });
      const traces = getTraces();
      const found = traces.find((t) => t.spanId === fakeSpanId);
      expect(found).toBeDefined();
      expect(found!.stage).toBe("custom-stage");
      expect(found!.agent).toBe("tester");
      expect(found!.status).toBe("ok");
      expect(found!.durationMs).toBeGreaterThan(0);

      // test rawName fallback when no attributes.stage: create stage via name only
      _resetForTests();
      const s = (tracingProvider as any).startSpan("stage:fallback-test", { parentSpan: null }) as any;
      const traces2 = getTraces();
      const fb = traces2.find((t) => t.name === "stage:fallback-test");
      expect(fb!.stage).toBe("fallback-test");
      expect(fb!.agent).toBe("unknown");

      // test mission prefix slicing branch with workflowId absent
      _resetForTests();
      (tracingProvider as any).startSpan("mission:slice-test", { parentSpan: null });
      const traces3 = getTraces();
      const slice = traces3.find((t) => t.name === "mission:slice-test");
      expect(slice!.stage).toBe("slice-test");

      // test startTime fallback and status error via plain object with missing startTime and status error
      _resetForTests();
      const tid2 = crypto.randomBytes(16).toString("hex") as TraceId;
      const sid2 = crypto.randomBytes(8).toString("hex") as SpanId;
      const missingStartSpan: any = {
        spanContext: { traceId: tid2, spanId: sid2, traceFlags: 0 },
        parentSpanId: null,
        traceId: tid2,
        spanId: sid2,
        // no name, no startTime, status error
        status: "error",
        // no attributes, no toJSON
      };
      anyProv.spansByTrace.set(tid2, [missingStartSpan]);
      anyProv.traceMeta.set(tid2, { missionId: "miss", sampling: { sampled: false, reason: "x" }, ratio: 0 });
      const traces4 = getTraces();
      const ms = traces4.find((t) => t.spanId === sid2);
      expect(ms).toBeDefined();
      expect(ms!.stage).toBe("");
      expect(ms!.agent).toBe("unknown");
      expect(ms!.status).toBe("error");
      expect(ms!.start).toBeDefined();
      expect(ms!.end).toBeUndefined();
      expect(ms!.durationMs).toBeUndefined();
      expect(ms!.parentSpanId).toBeNull();

      // test span with toJSON returning no attributes
      _resetForTests();
      const tid3 = crypto.randomBytes(16).toString("hex") as TraceId;
      const sid3 = crypto.randomBytes(8).toString("hex") as SpanId;
      const withToJSONNoAttrs: any = {
        spanContext: { traceId: tid3, spanId: sid3, traceFlags: 1 },
        parentSpanId: sid3,
        toJSON: () => ({
          traceId: tid3,
          spanId: sid3,
          parentSpanId: null,
          name: "stage:json-no-attrs",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          // no attributes key
          status: "ok",
          traceFlags: 1,
        }),
      };
      anyProv.spansByTrace.set(tid3, [withToJSONNoAttrs]);
      anyProv.traceMeta.set(tid3, { missionId: "x", sampling: { sampled: true, reason: "r" }, ratio: 1 });
      const traces5 = getTraces();
      const jna = traces5.find((t) => t.spanId === sid3);
      expect(jna).toBeDefined();
      expect(jna!.attributes).toEqual({});
    });

    it("getTraces returns [] when provider has no methods", () => {
      const prov: any = tracingProvider as any;
      const origGetSpans = prov.getSpans;
      const origGetAll = prov.getAllTraceIds;
      prov.getSpans = undefined;
      prov.getAllTraceIds = undefined;
      expect(getTraces()).toEqual([]);
      prov.getSpans = origGetSpans;
      prov.getAllTraceIds = origGetAll;
    });

    it("getTraces handles empty provider", () => {
      _resetForTests();
      expect(getTraces()).toEqual([]);
    });
  });

  describe("startTrace branches", () => {
    it("without parentSpan (undefined) inherits activeContext", () => {
      const mission = startMissionTrace("active-inherit");
      // after mission, activeContext is set, startTrace without parent should inherit traceId and parentSpanId
      const stageId = startTrace("child-inherit", "agent1");
      const traces = getTraces();
      const child = traces.find((t) => t.spanId === stageId);
      expect(child!.traceId).toBe(mission.traceId);
      expect(child!.parentSpanId).toBe(mission.spanId);
    });

    it("with parentSpan null creates new trace", () => {
      const mission = startMissionTrace("root1");
      const nullParentId = startTrace("orphan", "agent2", null);
      const traces = getTraces();
      const orphan = traces.find((t) => t.spanId === nullParentId);
      expect(orphan!.traceId).not.toBe(mission.traceId);
      expect(orphan!.parentSpanId).toBeNull();
    });

    it("with explicit parentSpan context", () => {
      const mission = startMissionTrace("parent-explicit");
      const parentCtx: SpanContext = { traceId: mission.traceId, spanId: mission.spanId, traceFlags: 1 };
      const childId = startTrace("child-explicit", "agent3", parentCtx);
      const traces = getTraces();
      const child = traces.find((t) => t.spanId === childId);
      expect(child!.traceId).toBe(mission.traceId);
      expect(child!.parentSpanId).toBe(mission.spanId);
    });

    it("startTrace returns W3C spanId", () => {
      const id = startTrace("s", "a");
      expect(isValidSpanId(id)).toBe(true);
    });
  });

  describe("startMissionTrace", () => {
    it("with workflowId and attributes", () => {
      const res = startMissionTrace("m1", "wf1", { foo: "bar", num: 123, flag: true });
      expect(isValidTraceId(res.traceId)).toBe(true);
      expect(isValidSpanId(res.spanId)).toBe(true);
      expect(res.span.spanContext.traceId).toBe(res.traceId);
      const traces = getTraces();
      const m = traces.find((t) => t.traceId === res.traceId && t.name === "mission:m1");
      expect(m!.attributes?.workflowId).toBe("wf1");
      expect(m!.attributes?.foo).toBe("bar");
    });

    it("without workflowId / attributes defaults", () => {
      const res = startMissionTrace("m2");
      expect(res.traceId).toBeDefined();
      const traces = getTraces();
      const m = traces.find((t) => t.name === "mission:m2");
      expect(m!.attributes?.missionId).toBe("m2");
    });

    it("with empty attributes object", () => {
      const res = startMissionTrace("m3", undefined, {});
      expect(res.traceId).toBeDefined();
    });
  });

  describe("endTrace branches", () => {
    it("ends via direct spanBySpanId lookup", () => {
      const id = startTrace("to-end", "agent");
      endTrace(id);
      const traces = getTraces();
      const t = traces.find((x) => x.spanId === id);
      expect(t!.end).toBeDefined();
    });

    it("ends via traceId lookup (spanBySpanId traceId key)", () => {
      const { traceId } = startMissionTrace("trace-lookup");
      endTrace(traceId);
      const traces = getTraces();
      const m = traces.find((x) => x.traceId === traceId);
      expect(m!.end).toBeDefined();
    });

    it("ends via provider search when spanBySpanId cleared", () => {
      const mission = startMissionTrace("search-fallback");
      const childId = startTrace("child-search", "agent", mission.span.spanContext);
      // clear direct map to force provider search
      const prov: any = tracingProvider as any;
      // access internal spanBySpanId via module? It's private but endTrace first tries spanBySpanId.get; after _reset we cleared? Instead we clear via _resetForTests partial?
      // Simulate by clearing spanBySpanId via _reset then re-adding provider state? Easier: use _resetForTests which clears spanBySpanId but not provider? Actually _reset clears both. So we need different approach: manually clear spanBySpanId by calling _reset then re-adding spans? Simpler: we can start span, then clear spanBySpanId via spying internal map by not using _reset but directly via tracing module's closure variable — not accessible.
      // Alternative: test endTrace with id that is not in spanBySpanId but is in provider: create stage, then create new trace that overwrites? Instead we rely on the fact endTrace also tries spanBySpanId traceId key, but after startTrace, span is stored under both keys. To force miss, we can call _resetForTests after start, then re-inject provider spans without re-adding to spanBySpanId.
      // So we simulate: startMissionTrace creates entry in both. Then we call _resetForTests which clears both, but we need provider to still have spans. So we capture provider state before reset, then restore after reset but without restoring spanBySpanId.
      const savedSpansByTrace = new Map(prov.spansByTrace);
      const savedMeta = new Map(prov.traceMeta);
      _resetForTests();
      // restore provider maps
      for (const [k, v] of savedSpansByTrace) prov.spansByTrace.set(k, v);
      for (const [k, v] of savedMeta) prov.traceMeta.set(k, v);
      // now spanBySpanId is empty, provider has spans
      endTrace(childId);
      const traces = getTraces();
      const child = traces.find((x) => x.spanId === childId);
      expect(child!.end).toBeDefined();
    });

    it("ends via traceId fallback when find by spanId fails but tid matches", () => {
      // Craft provider state where getSpans returns spans that don't match spanId but tid equals query
      const prov: any = tracingProvider as any;
      const fakeTid = crypto.randomBytes(16).toString("hex") as TraceId;
      const fakeSid = crypto.randomBytes(8).toString("hex") as SpanId;
      const fakeSpan: any = {
        spanContext: { traceId: "b".repeat(32) as TraceId, spanId: fakeSid, traceFlags: 1 },
        parentSpanId: null,
        name: "stage:fake",
        startTime: new Date().toISOString(),
        toJSON: () => ({ traceId: "b".repeat(32), spanId: fakeSid, parentSpanId: null, name: "stage:fake", startTime: new Date().toISOString(), endTime: undefined, attributes: {}, status: "ok", traceFlags: 1 }),
        setStatus: vi.fn(),
        end: vi.fn(),
      };
      // set trace with different traceId than fakeSid, but map key is fakeTid which we will query
      prov.spansByTrace.set(fakeTid as any, [fakeSpan]);
      prov.traceMeta.set(fakeTid as any, { missionId: "fake", sampling: { sampled: true, reason: "r" }, ratio: 1 });
      // Now query endTrace with fakeTid: first loop find will try to find span where spanContext.traceId === fakeTid OR spanId === fakeTid — fails because span's traceId is "b...". But second loop tid===fakeTid will succeed and take last span.
      endTrace(fakeTid);
      expect(fakeSpan.setStatus).toHaveBeenCalled();
      expect(fakeSpan.end).toHaveBeenCalled();
    });

    it("no-op when not found", () => {
      expect(() => endTrace("nonexistent")).not.toThrow();
    });

    it("no-op when provider lacks getSpans/getAllTraceIds", () => {
      const prov: any = tracingProvider as any;
      const origGetSpans = prov.getSpans;
      const origGetAll = prov.getAllTraceIds;
      prov.getSpans = undefined;
      prov.getAllTraceIds = undefined;
      expect(() => endTrace("any")).not.toThrow();
      prov.getSpans = origGetSpans;
      prov.getAllTraceIds = origGetAll;
    });

    it("handles setStatus and end throwing", () => {
      const id = startTrace("throw-test", "agent");
      const prov: any = tracingProvider as any;
      // get span via provider
      const span = prov.getSpans(prov.getAllTraceIds()[0]).find((s: any) => s.spanContext.spanId === id) as any;
      span.setStatus = () => { throw new Error("setStatus fail"); };
      span.end = () => { throw new Error("end fail"); };
      expect(() => endTrace(id, "error")).not.toThrow();
      // also test default status ok path already covered
      // status param default
      const id2 = startTrace("default-status", "a");
      const span2 = prov.getSpans(prov.getAllTraceIds().find((t: any) => true)).find((s: any) => s.spanContext.spanId === id2) as any;
      // make it throw too but with default ok
      span2.setStatus = () => { throw new Error("fail"); };
      span2.end = () => { throw new Error("fail"); };
      expect(() => endTrace(id2)).not.toThrow();
    });

    it("endTrace with error status sets error", () => {
      const id = startTrace("err-status", "a");
      endTrace(id, "error");
      const traces = getTraces();
      const t = traces.find((x) => x.spanId === id);
      expect(t!.status).toBe("error");
    });
  });

  describe("delegation helpers", () => {
    it("getActiveContext delegates", () => {
      _resetForTests();
      expect(getActiveContext()).toBeNull();
      const { traceId, spanId } = startMissionTrace("active-ctx");
      const ctx = getActiveContext();
      expect(ctx!.traceId).toBe(traceId);
      expect(ctx!.spanId).toBe(spanId);
    });

    it("getActiveContext returns null when provider has no method", () => {
      const prov: any = tracingProvider as any;
      const orig = prov.getActiveContext;
      prov.getActiveContext = undefined;
      expect(getActiveContext()).toBeNull();
      prov.getActiveContext = orig;
    });

    it("withContext delegates and restores", () => {
      const mission = startMissionTrace("with-ctx");
      const ctx: TraceContext = { traceId: mission.traceId, spanId: mission.spanId, traceFlags: 1 };
      let inside: TraceContext | null = null;
      const res = withContext(ctx, () => {
        inside = getActiveContext();
        return 42;
      });
      expect(res).toBe(42);
      expect(inside!.spanId).toBe(ctx.spanId);
      expect(getActiveContext()!.spanId).toBe(mission.spanId);
    });

    it("extract and inject delegate", () => {
      const traceId = "a".repeat(32) as TraceId;
      const spanId = "b".repeat(16) as SpanId;
      const ctx: TraceContext = { traceId, spanId, traceFlags: 1 };
      const headers: Record<string, string> = {};
      inject(ctx, headers);
      expect(headers.traceparent).toBe(`00-${traceId}-${spanId}-01`);
      const out = extract(headers);
      expect(out!.traceId).toBe(traceId);
    });

    it("persistTraces delegates to provider.persist", async () => {
      const mission = startMissionTrace("persist-deleg");
      const p = await persistTraces("persist-deleg");
      expect(p).not.toBeNull();
      // verify write was attempted (delegates to real fs, but race with parallel suite may delete file)
      expect(mockedWriteFileSync).toHaveBeenCalled();
      // with override
      const p2 = await persistTraces("persist-deleg", mission.traceId);
      expect(p2).not.toBeNull();
    });

    it("persistTraces returns null when provider has no persist", async () => {
      const prov: any = tracingProvider as any;
      const orig = prov.persist;
      prov.persist = undefined;
      expect(await persistTraces("any")).toBeNull();
      prov.persist = orig;
    });

    it("toEvidenceTraces delegates when provider has method", async () => {
      startMissionTrace("ev-deleg");
      // mock existsSync true for this mission to avoid race with parallel suite deleting traces dir
      const realExists = mockedExistsSync.getMockImplementation();
      mockedExistsSync.mockImplementation((p: any) => {
        if (typeof p === "string" && p.includes("ev-deleg")) return true as any;
        return (realExists as any)?.(p) ?? (actualFs.existsSync as any)(p);
      });
      await persistTraces("ev-deleg");
      const snap = toEvidenceTraces("ev-deleg");
      expect(snap).not.toBeNull();
      expect(snap!.traceId).toBeDefined();
      // restore
      if (realExists) mockedExistsSync.mockImplementation(realExists as any);
    });

    it("flush delegates", async () => {
      startMissionTrace("flush-deleg");
      // avoid race with parallel otel suite deleting traces dir — mock fs to no-op
      const origMkdir = mockedMkdirSync.getMockImplementation();
      const origWrite = mockedWriteFileSync.getMockImplementation();
      mockedMkdirSync.mockImplementation(() => undefined as any);
      mockedWriteFileSync.mockImplementation(() => undefined as any);
      await expect(flush()).resolves.not.toThrow();
      if (origMkdir) mockedMkdirSync.mockImplementation(origMkdir as any);
      if (origWrite) mockedWriteFileSync.mockImplementation(origWrite as any);
    });

    it("flush no-op when provider has no flush", async () => {
      const prov: any = tracingProvider as any;
      const orig = prov.flush;
      prov.flush = undefined;
      await expect(flush()).resolves.not.toThrow();
      prov.flush = orig;
    });

    it("shutdown delegates", async () => {
      const p = new OtelTracingProvider({ ratio: 1, parentBased: true });
      // need to test tracing.ts shutdown delegates to provider.shutdown; we can spy on tracingProvider.shutdown
      const prov: any = tracingProvider as any;
      const spy = vi.spyOn(prov, "shutdown");
      await shutdown();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
      // shutdown no-op when no method
      const orig = prov.shutdown;
      prov.shutdown = undefined;
      await expect(shutdown()).resolves.not.toThrow();
      prov.shutdown = orig;
      // restore provider shutdown flag? We shutdown tracingProvider, so need to reset: recreate provider state via _resetForTests won't clear shutdownFlag, but we mocked shutdown. To continue other tests, we need to reset shutdownFlag.
      // _resetForTests doesn't clear shutdownFlag, so we manually reset
      prov.shutdownFlag = false;
    });
  });

  describe("toEvidenceTraces fallback when provider lacks method", () => {
    it("returns null when file not exists", () => {
      const prov: any = tracingProvider as any;
      const orig = prov.toEvidenceTraces;
      prov.toEvidenceTraces = undefined;
      mockedExistsSync.mockImplementation(() => false as any);
      expect(toEvidenceTraces("no-file")).toBeNull();
      prov.toEvidenceTraces = orig;
    });

    it("returns snapshot when file exists", async () => {
      const prov: any = tracingProvider as any;
      const origToEv = prov.toEvidenceTraces;
      prov.toEvidenceTraces = undefined;

      const traceId = "a".repeat(32) as TraceId;
      const missionId = "fallback-mission";
      const fileContent = {
        traceId,
        spans: [{ traceFlags: 1 }, { traceFlags: 0 }],
        parentSpanId: null,
      };
      // mock existsSync true and readFileSync returns content
      mockedExistsSync.mockImplementation(() => true as any);
      mockedReadFileSync.mockImplementation(() => JSON.stringify(fileContent) as any);

      const snap = toEvidenceTraces(missionId);
      expect(snap!.traceId).toBe(traceId);
      expect(snap!.file).toBe(`behavior-os/runtime/traces/${missionId}.json`);
      expect(snap!.exists).toBe(true);
      expect(snap!.spanCount).toBe(2);
      expect(snap!.sampled).toBe(true);
      expect(snap!.parentSpanId).toBeNull();

      // sampled false case
      mockedReadFileSync.mockImplementation(() => JSON.stringify({ traceId, spans: [{ traceFlags: 0 }], parentSpanId: "b".repeat(16) }) as any);
      const snap2 = toEvidenceTraces(missionId);
      expect(snap2!.sampled).toBe(false);
      expect(snap2!.parentSpanId).toBe("b".repeat(16));

      // spanCount fallback when spans missing
      mockedReadFileSync.mockImplementation(() => JSON.stringify({ traceId }) as any);
      const snap3 = toEvidenceTraces(missionId);
      expect(snap3!.spanCount).toBe(0);

      prov.toEvidenceTraces = origToEv;
    });

    it("returns null when readFileSync throws", () => {
      const prov: any = tracingProvider as any;
      const orig = prov.toEvidenceTraces;
      prov.toEvidenceTraces = undefined;
      mockedExistsSync.mockImplementation(() => true as any);
      mockedReadFileSync.mockImplementation(() => { throw new Error("read fail"); });
      expect(toEvidenceTraces("any")).toBeNull();
      prov.toEvidenceTraces = orig;
    });

    it("returns null when JSON invalid", () => {
      const prov: any = tracingProvider as any;
      const orig = prov.toEvidenceTraces;
      prov.toEvidenceTraces = undefined;
      mockedExistsSync.mockImplementation(() => true as any);
      mockedReadFileSync.mockImplementation(() => "invalid json" as any);
      expect(toEvidenceTraces("any")).toBeNull();
      prov.toEvidenceTraces = orig;
    });
  });

  describe("_resetForTests", () => {
    it("clears provider state and span map", () => {
      startMissionTrace("to-reset");
      startTrace("child", "agent");
      expect(getTraces().length).toBeGreaterThan(0);
      expect(getActiveContext()).not.toBeNull();
      _resetForTests();
      expect(getTraces()).toEqual([]);
      expect(getActiveContext()).toBeNull();
    });

    it("handles provider missing fields without throwing", () => {
      const prov: any = tracingProvider as any;
      const savedSpansByTrace = prov.spansByTrace;
      const savedMeta = prov.traceMeta;
      const savedContextStack = prov.contextStack;
      const savedSpanStack = prov.spanStack;
      // delete to simulate missing
      delete prov.spansByTrace;
      delete prov.traceMeta;
      delete prov.contextStack;
      delete prov.spanStack;
      expect(() => _resetForTests()).not.toThrow();
      // restore
      prov.spansByTrace = savedSpansByTrace ?? new Map();
      prov.traceMeta = savedMeta ?? new Map();
      prov.contextStack = savedContextStack ?? [];
      prov.spanStack = savedSpanStack ?? [];
      prov.activeContext = null;
      prov.activeSpan = null;
    });

    it("is idempotent", () => {
      expect(() => { _resetForTests(); _resetForTests(); }).not.toThrow();
    });

    it("covers catch when provider throws inside try", () => {
      const prov: any = tracingProvider as any;
      const origClear = prov.spansByTrace?.clear;
      if (prov.spansByTrace) {
        const spy = vi.spyOn(prov.spansByTrace, "clear").mockImplementation(() => { throw new Error("clear fail"); });
        expect(() => _resetForTests()).not.toThrow();
        spy.mockRestore();
        // after catch, spanBySpanId still cleared
        expect(getTraces()).toEqual([]);
      } else {
        // force throw via making tracingProvider null-ish? alternative: mock global throw
        expect(() => _resetForTests()).not.toThrow();
      }
      // ensure spanBySpanId cleared even when provider throws
      startTrace("after-catch", "a");
      expect(getTraces().length).toBe(1);
      _resetForTests();
    });
  });

  describe("additional branch coverage", () => {
    it("startMissionTrace with parentSpan null explicit and attributes merging", () => {
      const r = startMissionTrace("merge-test", "wf-merge", { a: 1 });
      expect(r.span.spanContext.traceId).toBe(r.traceId);
      // second call with same mission but new trace? Should create new trace because parentSpan null explicit
      const r2 = startMissionTrace("merge-test2", undefined, { b: 2 });
      expect(r2.traceId).not.toBe(r.traceId);
    });

    it("endTrace finds last span when multiple with same traceId", () => {
      const mission = startMissionTrace("multi-span");
      const child1 = startTrace("c1", "a", mission.span.spanContext);
      const child2 = startTrace("c2", "a", mission.span.spanContext);
      // clear direct map to force provider search fallback where tid === traceId -> picks last
      const prov: any = tracingProvider as any;
      const savedSpansByTrace = new Map(prov.spansByTrace);
      const savedMeta = new Map(prov.traceMeta);
      _resetForTests();
      for (const [k, v] of savedSpansByTrace) prov.spansByTrace.set(k, v);
      for (const [k, v] of savedMeta) prov.traceMeta.set(k, v);
      // now query with traceId, both find path: first loop will find first matching span (child1) but we want last? Actually endTrace's first loop returns first find, second fallback only if not found. To hit second fallback we already tested. For multi-span, first loop returns first match, not last. But we can test that endTrace ends correct span by passing spanId of child2 directly via provider search after clearing.
      endTrace(child2);
      const traces = getTraces();
      const c2 = traces.find((t) => t.spanId === child2);
      expect(c2!.end).toBeDefined();
    });
  });
});
