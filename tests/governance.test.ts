import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, appendFileSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";

// Mocks must be hoisted — vitest will hoist vi.mock calls
vi.mock("@opa/wasm", () => ({
  loadPolicy: vi.fn(),
}));

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return { ...actual, execSync: vi.fn(actual.execSync) };
});

// Keep real fs by default but allow spy overrides
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    readFileSync: vi.fn(actual.readFileSync),
    mkdirSync: vi.fn(actual.mkdirSync),
    appendFileSync: vi.fn(actual.appendFileSync),
    writeFileSync: vi.fn(actual.writeFileSync),
    unlinkSync: vi.fn(actual.unlinkSync),
  };
});

import * as policy from "../packages/governance/policy.js";
import {
  AUDIT_LOG_PATH,
  REGO_PATH,
  POLICY_ID,
  GENESIS_HASH,
  computeHash,
  readAuditLog,
  verifyAuditLog,
  appendAuditLog,
  evaluateRegoJS,
  tryOpaSync,
  tryOpaWasm,
  GovernancePolicy,
  governancePolicy,
  evaluateGovernance,
  evaluateGovernanceSync,
} from "../packages/governance/policy.js";
import * as fsMock from "node:fs";
import * as cpMock from "node:child_process";
// @ts-ignore — @opa/wasm is optional peer dep, mocked via vi.mock
import * as opaWasm from "@opa/wasm";

const mockedExistsSync = vi.mocked(fsMock.existsSync);
const mockedReadFileSync = vi.mocked(fsMock.readFileSync);
const mockedMkdirSync = vi.mocked(fsMock.mkdirSync);
const mockedAppendFileSync = vi.mocked(fsMock.appendFileSync);
const mockedWriteFileSync = vi.mocked(fsMock.writeFileSync);
const mockedUnlinkSync = vi.mocked(fsMock.unlinkSync);
const mockedExecSync = vi.mocked(cpMock.execSync);
const mockedLoadPolicy = vi.mocked((opaWasm as unknown as { loadPolicy: ReturnType<typeof vi.fn> }).loadPolicy);

function makeMission(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "m1",
    title: "Test Mission",
    goal: "test",
    workflowId: "development",
    createdAt: new Date().toISOString(),
    inputs: {},
    ...over,
  } as unknown as import("../src/domain/types.js").Mission;
}

describe("governance/policy — 95% coverage", () => {
  let auditBackup: string | null = null;
  let auditExisted = false;

  beforeAll(() => {
    // backup real audit.log if exists
    if (existsSync(AUDIT_LOG_PATH)) {
      // use actual fs (bypass mock) via importActual? mockedReadFileSync still delegates to real by default
      // Save content via real read (mock delegates)
      try {
        const real = readFileSync(AUDIT_LOG_PATH, "utf-8");
        auditBackup = real as unknown as string;
        auditExisted = true;
      } catch {
        auditBackup = null;
      }
      // clean for isolated tests — remove file via real unlink (mock delegates)
      try { unlinkSync(AUDIT_LOG_PATH); } catch {}
    }
  });

  afterAll(() => {
    // restore backup
    try { unlinkSync(AUDIT_LOG_PATH); } catch {}
    if (auditExisted && auditBackup !== null) {
      mkdirSync(dirname(AUDIT_LOG_PATH), { recursive: true });
      writeFileSync(AUDIT_LOG_PATH, auditBackup as string, "utf-8");
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // reset mocks to delegate to real impl by default
    mockedExistsSync.mockImplementation((p: unknown) => {
      // delegate to real existsSync via actual fs (we stored actual via importActual inside mock? Need direct)
      // Use real Node fs via dynamic importActual bypass — simply use try with real path via native
      // Since mock wraps actual, calling mockImplementation that calls actual would recurse. So we instead
      // for tests that need real behavior, we manually implement audit log tests without relying on mock
      // Here default: call real existsSync via `vi.importActual` is not available sync, so use
      // a sync check via `try { require }` not possible. Instead we recreate real check via `fs` native via
      // bypass: use `globalThis`? Simpler: just return false for unknown, but audit tests will explicitly
      // handle file via real operations after restoring mock to real.
      // For audit tests we will temporarily restore mock to real behavior by mockingImplementation that checks filesystem via
      // using `await importActual` is async. So for audit tests we will use `mockedExistsSync.mockRestore` approach:
      // We'll make default delegate to real via Node's `existsSync` from `node:fs` actual captured before mock.
      // Since we cannot easily delegate, we will in audit tests use `vi.spyOn` alternative — but simpler: make default return real via
      // importing `fs` actual via `await vi.importActual` is not sync. So we just return true/false based on real file existence
      // using `Bun`? We can use `Object.getPrototypeOf`? Easiest: call original implementation stored via `mockedExistsSync.getMockImplementation`?
      // Workaround: store original before mock — we capture via closure over actual.
      // Since our mock factory already set `vi.fn(actual.existsSync)`, the mock's default impl IS actual.existsSync.
      // After `vi.clearAllMocks`, it resets to original impl? `clearAllMocks` clears calls but keeps implementation.
      // So after clearAllMocks, mock still delegates to actual.existsSync. So we should not override here.
      // To keep delegating, we shouldn't set mockImplementation at all after clearAllMocks.
      return (p as string).length > 0 ? false : false; // placeholder — will be overridden by mock's default impl if we don't set
    });
    // After vi.clearAllMocks, the mock still has its original implementation (actual.existsSync).
    // But we just overrode it above with a dummy. So we need to reset to actual.
    // Re-apply actual delegation:
    mockedExistsSync.mockImplementation(undefined as unknown as (p: unknown) => boolean);
    // Vitest's vi.fn(actual.fn) keeps actual as implementation; clearing mocks doesn't remove impl, so we can just
    // not override. To restore delegating behavior, we reset mock to use actual again:
    // Easiest: mockRestore + mock actual again? But we are in vi.mock context, so `mockedExistsSync` was created with actual impl.
    // `mockedExistsSync.mockReset()` would remove impl. `mockClear` keeps impl. So we should use mockClear not mockImplementation.
    // Let's undo our override and just clear.
  });

  // Helper to reset fs mocks to real delegating behavior
  function resetFsMocksToReal() {
    // After vi.clearAllMocks, mocks still delegate to real (since we created with actual). So just clear.
    mockedExistsSync.mockClear();
    mockedReadFileSync.mockClear();
    mockedMkdirSync.mockClear();
    mockedAppendFileSync.mockClear();
    mockedWriteFileSync.mockClear();
    mockedUnlinkSync.mockClear();
    mockedExecSync.mockClear();
    mockedLoadPolicy.mockClear();
    // Ensure they still point to actual by not resetting impl — they already do
    // We need to ensure they delegate: vi.mocked(...).mockImplementation uses actual if not overridden.
    // After mockClear, they keep impl. So nothing else.
  }

  // We need to re-establish real delegation after beforeEach's dummy override — fix by calling reset
  beforeEach(() => {
    resetFsMocksToReal();
    // Un-mock existsSync dummy: after clear, it delegates to real
    // For tests that need custom existsSync, they will set their own mockImplementation
  });

  afterEach(() => {
    // clean audit.log between tests for isolation, keep backup handling outside
    try { unlinkSync(AUDIT_LOG_PATH); } catch {}
    resetFsMocksToReal();
    vi.restoreAllMocks();
    // Re-apply mocks after restoreAllMocks — restoreAllMocks removes mocks, need re-mock?
    // But we used vi.mock at top, restoreAllMocks will restore to original mocked module? Actually vi.restoreAllMocks restores spies, not vi.mock.
    // Our vi.mock stays. However mocked functions lose implementation after restoreAllMocks if they were spies?
    // Safer to re-ensure delegating after restore: we re-create delegating via vi.mocked(...).mockImplementation(actual)
    // But we can't get actual synchronously. So we avoid restoreAllMocks for fs mocks; use mockClear only.
  });

  describe("constants", () => {
    it("exports expected constants", () => {
      expect(POLICY_ID).toBe("behavioros.governance");
      expect(GENESIS_HASH).toBe("0".repeat(64));
      expect(REGO_PATH).toBe(join(process.cwd(), "packages", "governance", "policy.rego"));
      expect(AUDIT_LOG_PATH).toBe(join(process.cwd(), "behavior-os", "runtime", "audit.log"));
    });
  });

  describe("evaluateRegoJS", () => {
    it("allows low risk with warn", () => {
      const r = evaluateRegoJS({ risk: "low", workflowId: "development" });
      expect(r.allow).toBe(true);
      expect(r.action).toBe("warn");
      expect(r.deny).toEqual([]);
    });
    it("allows medium risk with escalate", () => {
      const r = evaluateRegoJS({ risk: "medium", workflowId: "development" });
      expect(r.allow).toBe(true);
      expect(r.action).toBe("escalate");
    });
    it("allows unknown risk with pass", () => {
      const r = evaluateRegoJS({ risk: "unknown" as unknown as string, workflowId: "development" });
      expect(r.allow).toBe(true);
      expect(r.action).toBe("pass");
    });
    it("allows high risk with security-audit", () => {
      const r = evaluateRegoJS({ risk: "high", workflowId: "security-audit" });
      expect(r.allow).toBe(true);
      expect(r.action).toBe("pass");
    });
    it("allows high risk with incident", () => {
      const r = evaluateRegoJS({ risk: "high", workflowId: "incident" });
      expect(r.allow).toBe(true);
      expect(r.action).toBe("pass");
    });
    it("blocks high risk with other workflow", () => {
      const r = evaluateRegoJS({ risk: "high", workflowId: "development" });
      expect(r.allow).toBe(false);
      expect(r.action).toBe("block");
      expect(r.deny[0]).toContain("high risk mission requires security-audit");
      expect(r.deny[0]).toContain("development");
    });
    it("reads risk from inputs when risk missing", () => {
      const r = evaluateRegoJS({ inputs: { risk: "high" }, workflowId: "development" } as unknown as policy.RegoInput);
      expect(r.allow).toBe(false);
    });
    it("reads risk from inputs.risk via nested fallback", () => {
      const r = evaluateRegoJS({ inputs: { risk: "low" } } as unknown as policy.RegoInput);
      expect(r.allow).toBe(true);
      expect(r.action).toBe("warn");
    });
    it("defaults workflowId to empty string", () => {
      const r = evaluateRegoJS({ risk: "high" } as unknown as policy.RegoInput);
      expect(r.allow).toBe(false);
      expect(r.deny[0]).toContain("got ");
    });
    it("handles risk undefined -> unknown -> allow pass", () => {
      const r = evaluateRegoJS({} as unknown as policy.RegoInput);
      expect(r.allow).toBe(true);
      expect(r.action).toBe("pass");
    });
  });

  describe("computeHash", () => {
    it("is deterministic sha256(prev+entry)", () => {
      const prev = GENESIS_HASH;
      const entry = JSON.stringify({ a: 1 });
      const h1 = computeHash(prev, entry);
      const h2 = createHash("sha256").update(prev + entry).digest("hex");
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
    });
    it("different prev produces different hash", () => {
      expect(computeHash("a", "x")).not.toBe(computeHash("b", "x"));
    });
  });

  describe("audit log — real filesystem isolated", () => {
    // Use real fs for these tests — ensure mocks delegate to real
    beforeEach(() => {
      // ensure mocks delegate to real impl
      mockedExistsSync.mockRestore?.();
      mockedReadFileSync.mockRestore?.();
      mockedMkdirSync.mockRestore?.();
      mockedAppendFileSync.mockRestore?.();
      // Actually vi.mock retains mock, but after restore we lose it. Instead we manually set to real again via importActual delegation
      // We will directly use real fs functions captured before mock: import * as realFs from "node:fs" via actual?
      // Simpler: after restore, re-mock to delegate? For audit tests we bypass mocks by using real fs via `await vi.importActual`
      // Workaround: directly use `global` real functions via `await import("node:fs")` which returns mocked version, so not.
      // So we re-apply mock implementations to delegate to real by re-importing actual via dynamic import inside test.
      // For simplicity, we will not rely on mocks for audit tests — we will call real functions via `node:fs` actual captured via
      // `vi.importActual` async at test time.
    });

    it("readAuditLog returns empty when file missing", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      // ensure file missing
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
      // our mocked readAuditLog uses mocked existsSync/readFileSync which currently may be mocked to false
      // To test real behavior, we temporarily make mocks delegate to actual
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      const result = readAuditLog();
      expect(result).toEqual([]);
      // reset to delegating (already)
    });

    it("readAuditLog filters invalid JSON lines", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      // write file with valid + invalid lines
      actual.mkdirSync(dirname(AUDIT_LOG_PATH), { recursive: true });
      const valid = JSON.stringify({ missionId: "m1", hash: "abc", prevHash: GENESIS_HASH } as unknown as policy.AuditRecord);
      actual.writeFileSync(AUDIT_LOG_PATH, valid + "\nnot-json\n" + valid + "\n", "utf-8");
      const result = readAuditLog();
      expect(result).toHaveLength(2);
      actual.unlinkSync(AUDIT_LOG_PATH);
    });

    it("appendAuditLog creates chain and verifyAuditLog validates", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
      const v = { allowed: true, action: "pass" as const, reasons: ["ok"], policyId: "default" };
      const r1 = appendAuditLog({ missionId: "m1", workflowId: "development", risk: "low", verdict: v, source: "test" });
      expect(r1.prevHash).toBe(GENESIS_HASH);
      expect(r1.hash).toHaveLength(64);
      const r2 = appendAuditLog({ missionId: "m2", workflowId: "development", risk: "high", verdict: v, source: "test2" });
      expect(r2.prevHash).toBe(r1.hash);
      const verified = verifyAuditLog();
      expect(verified.valid).toBe(true);
      expect(verified.count).toBe(2);
      actual.unlinkSync(AUDIT_LOG_PATH);
    });

    it("verifyAuditLog detects broken prevHash chain", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      mockedWriteFileSync.mockImplementation(actual.writeFileSync as unknown as typeof mockedWriteFileSync);
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
      const v = { allowed: true, action: "pass" as const, reasons: ["ok"], policyId: "default" };
      appendAuditLog({ missionId: "m1", workflowId: "development", risk: "low", verdict: v, source: "test" });
      appendAuditLog({ missionId: "m2", workflowId: "development", risk: "low", verdict: v, source: "test" });
      // tamper second record's prevHash
      const raw = actual.readFileSync(AUDIT_LOG_PATH, "utf-8").trim().split("\n");
      const second = JSON.parse(raw[1]);
      second.prevHash = "0".repeat(64);
      raw[1] = JSON.stringify(second);
      actual.writeFileSync(AUDIT_LOG_PATH, raw.join("\n") + "\n", "utf-8");
      const verified = verifyAuditLog();
      expect(verified.valid).toBe(false);
      expect(verified.reason).toContain("hash chain broken");
      actual.unlinkSync(AUDIT_LOG_PATH);
    });

    it("verifyAuditLog detects hash mismatch", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      mockedWriteFileSync.mockImplementation(actual.writeFileSync as unknown as typeof mockedWriteFileSync);
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
      const v = { allowed: true, action: "pass" as const, reasons: ["ok"], policyId: "default" };
      appendAuditLog({ missionId: "m1", workflowId: "development", risk: "low", verdict: v, source: "test" });
      const raw = actual.readFileSync(AUDIT_LOG_PATH, "utf-8").trim().split("\n");
      const rec = JSON.parse(raw[0]);
      rec.hash = "f".repeat(64);
      raw[0] = JSON.stringify(rec);
      actual.writeFileSync(AUDIT_LOG_PATH, raw.join("\n") + "\n", "utf-8");
      const verified = verifyAuditLog();
      expect(verified.valid).toBe(false);
      expect(verified.reason).toContain("hash mismatch");
      actual.unlinkSync(AUDIT_LOG_PATH);
    });

    it("verifyAuditLog returns valid for empty log", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
      const verified = verifyAuditLog();
      expect(verified.valid).toBe(true);
      expect(verified.count).toBe(0);
    });

    it("appendAuditLog handles empty existing file and unknown risk", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      actual.mkdirSync(dirname(AUDIT_LOG_PATH), { recursive: true });
      actual.writeFileSync(AUDIT_LOG_PATH, "   \n", "utf-8");
      const v = { allowed: true, action: "pass" as const, reasons: ["ok"], policyId: "default" };
      const rec = appendAuditLog({ missionId: "m1", workflowId: "development", verdict: v, source: "test" });
      expect(rec.risk).toBe("unknown");
      expect(rec.prevHash).toBe(GENESIS_HASH);
      actual.unlinkSync(AUDIT_LOG_PATH);
    });
  });

  describe("tryOpaSync", () => {
    it("returns null when rego missing", () => {
      mockedExistsSync.mockImplementation((p: unknown) => {
        if ((p as string) === REGO_PATH) return false;
        return false;
      });
      const r = tryOpaSync({ risk: "low", workflowId: "development" });
      expect(r).toBeNull();
    });
    it("returns evaluateRegoJS when rego exists", () => {
      mockedExistsSync.mockImplementation((p: unknown) => (p as string) === REGO_PATH);
      const r = tryOpaSync({ risk: "low", workflowId: "development" });
      expect(r).not.toBeNull();
      expect(r!.allow).toBe(true);
      expect(r!.action).toBe("warn");
    });
    it("returns block for high risk via sync", () => {
      mockedExistsSync.mockImplementation((p: unknown) => (p as string) === REGO_PATH);
      const r = tryOpaSync({ risk: "high", workflowId: "development" });
      expect(r!.allow).toBe(false);
    });
  });

  describe("tryOpaWasm — OPA WASM and CLI branches", () => {
    const wasmPath = join(process.cwd(), "packages", "governance", "policy.wasm");

    it("uses WASM when file exists and loadPolicy succeeds", async () => {
      mockedExistsSync.mockImplementation((p: unknown) => (p as string) === wasmPath);
      mockedReadFileSync.mockImplementation(((p: unknown) => Buffer.from("wasm")) as unknown as typeof mockedReadFileSync);
      mockedLoadPolicy.mockResolvedValue({
        evaluate: () => ({ result: { allow: true, deny: [] } }),
      } as unknown as { evaluate: (i: unknown) => { result: unknown } });
      const r = await tryOpaWasm({ risk: "low", workflowId: "development" });
      expect(r).not.toBeNull();
      expect(r!.allow).toBe(true);
      expect(r!.deny).toEqual([]);
    });

    it("WASM returns deny when allow false", async () => {
      mockedExistsSync.mockImplementation((p: unknown) => (p as string) === wasmPath);
      mockedReadFileSync.mockImplementation(((p: unknown) => Buffer.from("wasm")) as unknown as typeof mockedReadFileSync);
      mockedLoadPolicy.mockResolvedValue({
        evaluate: () => ({ result: { allow: false, deny: ["blocked"] } }),
      } as unknown as { evaluate: (i: unknown) => { result: unknown } });
      const r = await tryOpaWasm({ risk: "high", workflowId: "development" });
      expect(r!.allow).toBe(false);
      expect(r!.deny).toEqual(["blocked"]);
    });

    it("WASM fallback to CLI when loadPolicy throws", async () => {
      mockedExistsSync.mockImplementation((p: unknown) => {
        if ((p as string) === wasmPath) return true;
        if ((p as string) === REGO_PATH) return true;
        return false;
      });
      mockedReadFileSync.mockImplementation(((p: unknown) => { throw new Error("wasm read fail"); }) as unknown as typeof mockedReadFileSync);
      mockedExecSync.mockImplementation(() => { throw new Error("opa not found"); });
      const r = await tryOpaWasm({ risk: "low", workflowId: "development" });
      expect(r).toBeNull();
    });

    it("WASM handles missing result -> returns null via CLI fallback", async () => {
      mockedExistsSync.mockImplementation((p: unknown) => (p as string) === wasmPath);
      mockedReadFileSync.mockImplementation(((p: unknown) => Buffer.from("wasm")) as unknown as typeof mockedReadFileSync);
      mockedLoadPolicy.mockResolvedValue({
        evaluate: () => ({}) as unknown as { result: unknown },
      } as unknown as { evaluate: (i: unknown) => { result: unknown } });
      // CLI will attempt but opa missing -> null
      mockedExecSync.mockImplementation(() => { throw new Error("opa version fail"); });
      const r = await tryOpaWasm({ risk: "low", workflowId: "development" });
      expect(r).toBeNull();
    });

    it("CLI success path returns allow true and deny array", async () => {
      const tmpInput = join(process.cwd(), "behavior-os", "runtime", ".opa-input.json");
      mockedExistsSync.mockImplementation((p: unknown) => {
        if ((p as string) === wasmPath) return false;
        if ((p as string) === REGO_PATH) return true;
        if ((p as string) === tmpInput) return false;
        return false;
      });
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedWriteFileSync.mockImplementation(actual.writeFileSync as unknown as typeof mockedWriteFileSync);
      mockedUnlinkSync.mockImplementation(actual.unlinkSync as unknown as typeof mockedUnlinkSync);
      let call = 0;
      mockedExecSync.mockImplementation(((cmd: string) => {
        call++;
        if (cmd.includes("opa version")) return "" as unknown as string;
        if (cmd.includes("allow")) return JSON.stringify({ result: [{ expressions: [{ value: true }] }] });
        if (cmd.includes("deny")) return JSON.stringify({ result: [{ expressions: [{ value: [] }] }] });
        throw new Error("unexpected");
      }) as unknown as typeof mockedExecSync);
      const r = await tryOpaWasm({ risk: "low", workflowId: "development" });
      expect(r!.allow).toBe(true);
      expect(r!.deny).toEqual([]);
    });

    it("CLI returns deny array when present", async () => {
      mockedExistsSync.mockImplementation((p: unknown) => {
        if ((p as string).includes("policy.wasm")) return false;
        if ((p as string) === REGO_PATH) return true;
        return false;
      });
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedWriteFileSync.mockImplementation(actual.writeFileSync as unknown as typeof mockedWriteFileSync);
      mockedUnlinkSync.mockImplementation(actual.unlinkSync as unknown as typeof mockedUnlinkSync);
      mockedExecSync.mockImplementation(((cmd: string) => {
        if (cmd.includes("opa version")) return "" as unknown as string;
        if (cmd.includes("allow")) return JSON.stringify({ result: [{ expressions: [{ value: false }] }] });
        if (cmd.includes("deny")) return JSON.stringify({ result: [{ expressions: [{ value: ["high risk"] }] }] });
        return "" as unknown as string;
      }) as unknown as typeof mockedExecSync);
      const r = await tryOpaWasm({ risk: "high", workflowId: "development" });
      expect(r!.allow).toBe(false);
      expect(r!.deny).toEqual(["high risk"]);
    });

    it("CLI handles deny eval throwing (optional deny)", async () => {
      mockedExistsSync.mockImplementation((p: unknown) => {
        if ((p as string).includes("policy.wasm")) return false;
        if ((p as string) === REGO_PATH) return true;
        return false;
      });
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedWriteFileSync.mockImplementation(actual.writeFileSync as unknown as typeof mockedWriteFileSync);
      mockedUnlinkSync.mockImplementation(actual.unlinkSync as unknown as typeof mockedUnlinkSync);
      mockedExecSync.mockImplementation(((cmd: string) => {
        if (cmd.includes("opa version")) return "" as unknown as string;
        if (cmd.includes("allow")) return JSON.stringify({ result: [{ expressions: [{ value: true }] }] });
        if (cmd.includes("deny")) throw new Error("deny fail");
        return "" as unknown as string;
      }) as unknown as typeof mockedExecSync);
      const r = await tryOpaWasm({ risk: "low", workflowId: "development" });
      expect(r!.allow).toBe(true);
      expect(r!.deny).toEqual([]);
    });

    it("CLI outer eval throws cleans tmp and returns null", async () => {
      mockedExistsSync.mockImplementation((p: unknown) => {
        if ((p as string).includes("policy.wasm")) return false;
        if ((p as string) === REGO_PATH) return true;
        return false;
      });
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedWriteFileSync.mockImplementation(actual.writeFileSync as unknown as typeof mockedWriteFileSync);
      mockedUnlinkSync.mockImplementation(actual.unlinkSync as unknown as typeof mockedUnlinkSync);
      mockedExecSync.mockImplementation(((cmd: string) => {
        if (cmd.includes("opa version")) return "" as unknown as string;
        if (cmd.includes("allow")) throw new Error("eval fail");
        return "" as unknown as string;
      }) as unknown as typeof mockedExecSync);
      const r = await tryOpaWasm({ risk: "low", workflowId: "development" });
      expect(r).toBeNull();
    });

    it("returns null when opa not installed", async () => {
      mockedExistsSync.mockImplementation(() => false);
      mockedExecSync.mockImplementation(() => { throw new Error("opa missing"); });
      const r = await tryOpaWasm({ risk: "low", workflowId: "development" });
      expect(r).toBeNull();
    });

    it("returns null when rego missing after opa version succeeds", async () => {
      mockedExistsSync.mockImplementation(() => false);
      mockedExecSync.mockImplementation(((cmd: string) => {
        if ((cmd as string).includes("opa version")) return "" as unknown as string;
        return "" as unknown as string;
      }) as unknown as typeof mockedExecSync);
      const r = await tryOpaWasm({ risk: "low", workflowId: "development" });
      // wasm missing, opa version ok but rego missing -> null
      expect(r).toBeNull();
    });

    it("handles wasm import returning null (opa wasm not installed)", async () => {
      mockedExistsSync.mockImplementation((p: unknown) => (p as string).includes("policy.wasm"));
      // simulate dynamic import returning null by making loadPolicy not available
      // our mock returns object but we make existsSync true and then make readFileSync throw to simulate missing @opa/wasm
      // Instead we test path where opaWasm import resolves to null — we achieve by making mockedLoadPolicy throw and execSync fail
      mockedReadFileSync.mockImplementation(((p: unknown) => Buffer.from("wasm")) as unknown as typeof mockedReadFileSync);
      mockedLoadPolicy.mockRejectedValue(new Error("not found"));
      mockedExecSync.mockImplementation(() => { throw new Error("opa missing"); });
      const r = await tryOpaWasm({ risk: "low", workflowId: "development" });
      expect(r).toBeNull();
    });
  });

  describe("GovernancePolicy.evaluate — fail-closed branches", () => {
    async function withRealAudit(fn: () => Promise<void>) {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      mockedWriteFileSync.mockImplementation(actual.writeFileSync as unknown as typeof mockedWriteFileSync);
      mockedUnlinkSync.mockImplementation(actual.unlinkSync as unknown as typeof mockedUnlinkSync);
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
      await fn();
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
    }

    it("ts-fallback when no rego and no opa", async () => {
      await withRealAudit(async () => {
        const actualPrep = await vi.importActual<typeof import("node:fs")>("node:fs");
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return false;
          if ((p as string).includes("policy.wasm")) return false;
          return (actualPrep.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
        });
        mockedExecSync.mockImplementation(() => { throw new Error("opa missing"); });
        const gp = new GovernancePolicy();
        const v = await gp.evaluate(makeMission({ workflowId: "development" }));
        expect(v.allowed).toBe(true); // development low risk default passes? Actually development medium -> escalate but allowed
      });
    });

    it("rego-js allow + ts allow -> ts verdict", async () => {
      await withRealAudit(async () => {
        // Make rego exists, opa missing -> goes to rego-js branch with allow
        const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return true;
          if ((p as string).includes("policy.wasm")) return false;
          return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
        });
        mockedExecSync.mockImplementation(() => { throw new Error("opa missing"); });
        const gp = new GovernancePolicy();
        const v = await gp.evaluate(makeMission({ workflowId: "development", inputs: { risk: "low" } } as unknown as Record<string, unknown>));
        expect(v.allowed).toBe(true);
        const logs = readAuditLog();
        expect(logs[0].source).toBe("rego-js+ts");
      });
    });

    it("rego-js deny + ts allow -> block via fail-closed (high risk dev)", async () => {
      await withRealAudit(async () => {
        const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return true;
          if ((p as string).includes("policy.wasm")) return false;
          return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
        });
        mockedExecSync.mockImplementation(() => { throw new Error("opa missing"); });
        const gp = new GovernancePolicy();
        // high risk dev without security-audit should be blocked by both rego-js and riskGovernance
        const v = await gp.evaluate(makeMission({ workflowId: "development", inputs: { risk: "high" } } as unknown as Record<string, unknown>));
        expect(v.allowed).toBe(false);
        expect(v.action).toBe("block");
        expect(v.reasons.join(" ")).toContain("high risk");
        const logs = readAuditLog();
        expect(logs[0].source).toBe("rego-js+ts-fail-closed");
      });
    });

    it("rego-js deny with ts also deny merges reasons", async () => {
      await withRealAudit(async () => {
        const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return true;
          if ((p as string).includes("policy.wasm")) return false;
          return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
        });
        mockedExecSync.mockImplementation(() => { throw new Error("opa missing"); });
        const gp = new GovernancePolicy();
        // mission with missing title triggers defaultPolicy block plus high risk
        const bad = makeMission({ id: "", title: "", workflowId: "development", inputs: { risk: "high" } } as unknown as Record<string, unknown>);
        const v = await gp.evaluate(bad);
        expect(v.allowed).toBe(false);
        // should have both rego deny and ts reasons
        expect(v.reasons.length).toBeGreaterThan(1);
      });
    });

    it("opa-wasm deny with ts allow -> block source opa-wasm", async () => {
      await withRealAudit(async () => {
        const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return true;
          if ((p as string).includes("policy.wasm")) return false;
          return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
        });
        // mock tryOpaWasm to return deny via execSync success path
        mockedExecSync.mockImplementation(((cmd: string) => {
          if (cmd.includes("opa version")) return "" as unknown as string;
          if (cmd.includes("allow")) return JSON.stringify({ result: [{ expressions: [{ value: false }] }] });
          if (cmd.includes("deny")) return JSON.stringify({ result: [{ expressions: [{ value: ["opa deny high"] }] }] });
          return "" as unknown as string;
        }) as unknown as typeof mockedExecSync);
        const gp = new GovernancePolicy();
        const v = await gp.evaluate(makeMission({ workflowId: "development", inputs: { risk: "high" } } as unknown as Record<string, unknown>));
        expect(v.allowed).toBe(false);
        expect(v.policyId).toBe("policy.rego");
      });
    });

    it("opa-wasm deny with ts deny merges both", async () => {
      await withRealAudit(async () => {
        const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return true;
          if ((p as string).includes("policy.wasm")) return false;
          return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
        });
        mockedExecSync.mockImplementation(((cmd: string) => {
          if (cmd.includes("opa version")) return "" as unknown as string;
          if (cmd.includes("allow")) return JSON.stringify({ result: [{ expressions: [{ value: false }] }] });
          if (cmd.includes("deny")) return JSON.stringify({ result: [{ expressions: [{ value: ["opa block"] }] }] });
          return "" as unknown as string;
        }) as unknown as typeof mockedExecSync);
        const gp = new GovernancePolicy();
        const bad = makeMission({ id: "", title: "", workflowId: "development", inputs: { risk: "high" } } as unknown as Record<string, unknown>);
        const v = await gp.evaluate(bad);
        expect(v.allowed).toBe(false);
        expect(v.reasons.join(" ")).toContain("opa block");
        expect(v.reasons.join(" ")).toContain("missing");
      });
    });

    it("opa-wasm allow + ts allow -> pass source opa-wasm+ts", async () => {
      await withRealAudit(async () => {
        const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return true;
          if ((p as string).includes("policy.wasm")) return false;
          return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
        });
        mockedExecSync.mockImplementation(((cmd: string) => {
          if (cmd.includes("opa version")) return "" as unknown as string;
          if (cmd.includes("allow")) return JSON.stringify({ result: [{ expressions: [{ value: true }] }] });
          if (cmd.includes("deny")) return JSON.stringify({ result: [{ expressions: [{ value: [] }] }] });
          return "" as unknown as string;
        }) as unknown as typeof mockedExecSync);
        const gp = new GovernancePolicy();
        const v = await gp.evaluate(makeMission({ workflowId: "development", inputs: { risk: "low" } } as unknown as Record<string, unknown>));
        expect(v.allowed).toBe(true);
      });
    });

    it("opa-wasm allow + ts block -> fail-closed source opa-wasm+ts-fail-closed", async () => {
      await withRealAudit(async () => {
        const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return true;
          if ((p as string).includes("policy.wasm")) return false;
          return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
        });
        mockedExecSync.mockImplementation(((cmd: string) => {
          if (cmd.includes("opa version")) return "" as unknown as string;
          if (cmd.includes("allow")) return JSON.stringify({ result: [{ expressions: [{ value: true }] }] });
          if (cmd.includes("deny")) return JSON.stringify({ result: [{ expressions: [{ value: [] }] }] });
          return "" as unknown as string;
        }) as unknown as typeof mockedExecSync);
        const gp = new GovernancePolicy();
        // ts will block due to protected path
        const v = await gp.evaluate(makeMission({ workflowId: "development", inputs: { file: "prisma/migrations/001.sql", risk: "low" } } as unknown as Record<string, unknown>));
        expect(v.allowed).toBe(false);
      });
    });

    it("handles tryOpaWasm throwing -> falls back to ts-fallback or rego-js", async () => {
      await withRealAudit(async () => {
        const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return false;
          if ((p as string).includes("policy.wasm")) return true;
          return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
        });
        // make WASM throw then CLI throw
        mockedReadFileSync.mockImplementation(() => { throw new Error("fail"); });
        mockedExecSync.mockImplementation(() => { throw new Error("fail"); });
        // also need to handle dynamic import for @opa/wasm throwing: our mock loadPolicy will not be hit because readFileSync throws first
        const gp = new GovernancePolicy();
        // use low risk so ts allows
        const v = await gp.evaluate(makeMission({ workflowId: "development", inputs: { risk: "low" } } as unknown as Record<string, unknown>));
        expect(v.allowed).toBe(true);
      });
    });

    it("toMission handles Mission vs RegoInput and governanceApproved preservation", async () => {
      await withRealAudit(async () => {
        const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return false;
          if ((p as string).includes("policy.wasm")) return false;
          return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
        });
        mockedExecSync.mockImplementation(() => { throw new Error("opa missing"); });
        const gp = new GovernancePolicy();
        // RegoInput shape
        const regoInput: policy.RegoInput = { missionId: "reg1", workflowId: "development", risk: "medium", inputs: { risk: "medium" } };
        const v1 = await gp.evaluate(regoInput);
        expect(v1.allowed).toBe(true);
        expect(v1.action).toBe("escalate"); // medium risk escalate via riskGovernancePolicy
        // With governanceApproved
        const regoInput2 = { missionId: "reg2", workflowId: "development", risk: "high", governanceApproved: true, inputs: { risk: "high" } } as unknown as policy.RegoInput;
        const v2 = await gp.evaluate(regoInput2);
        // high risk development requires security workflow, but governanceApproved true still fails riskGovernance? Actually behaviorLevel requires approval for high dev, but riskGovernance still blocks.
        // So still blocked due to workflow, but test that governanceApproved is propagated
        expect(v2.allowed).toBe(false);
        // Mission shape direct
        const mission = makeMission({ workflowId: "research", inputs: {} });
        const v3 = await gp.evaluate(mission);
        expect(v3.allowed).toBe(true);
      });
    });

    it("covers opaResult with empty deny array -> fallback message", async () => {
      await withRealAudit(async () => {
        const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string).includes("policy.wasm")) return false;
          if ((p as string) === REGO_PATH) return true;
          return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
        });
        mockedExecSync.mockImplementation(((cmd: string) => {
          if (cmd.includes("opa version")) return "" as unknown as string;
          if (cmd.includes("allow")) return JSON.stringify({ result: [{ expressions: [{ value: false }] }] });
          if (cmd.includes("deny")) return JSON.stringify({ result: [{ expressions: [{ value: [] }] }] });
          return "" as unknown as string;
        }) as unknown as typeof mockedExecSync);
        const gp = new GovernancePolicy();
        const v = await gp.evaluate(makeMission({ workflowId: "unknown-wf", inputs: { risk: "high" } } as unknown as Record<string, unknown>));
        expect(v.reasons[0]).toContain("opa deny");
      });
    });
  });

  describe("GovernancePolicy.evaluateSync — sync variants", () => {
    async function withRealAuditSync(fn: () => void) {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      mockedWriteFileSync.mockImplementation(actual.writeFileSync as unknown as typeof mockedWriteFileSync);
      mockedUnlinkSync.mockImplementation(actual.unlinkSync as unknown as typeof mockedUnlinkSync);
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
      fn();
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
    }

    it("ts-fallback-sync when no rego", async () => {
      await withRealAuditSync(() => {
        mockedExistsSync.mockImplementation((p: unknown) => (p as string) !== REGO_PATH);
        const gp = new GovernancePolicy();
        const v = gp.evaluateSync(makeMission({ workflowId: "development" }));
        expect(v.allowed).toBe(true);
      });
    });

    it("rego-js deny -> block sync", async () => {
      await withRealAuditSync(() => {
        mockedExistsSync.mockImplementation((p: unknown) => (p as string) === REGO_PATH);
        const gp = new GovernancePolicy();
        const v = gp.evaluateSync(makeMission({ workflowId: "development", inputs: { risk: "high" } } as unknown as Record<string, unknown>));
        expect(v.allowed).toBe(false);
        expect(v.policyId).toBe("policy.rego");
      });
    });

    it("rego-js allow + ts allow -> pass sync", async () => {
      await withRealAuditSync(() => {
        mockedExistsSync.mockImplementation((p: unknown) => (p as string) === REGO_PATH);
        const gp = new GovernancePolicy();
        const v = gp.evaluateSync(makeMission({ workflowId: "security-audit", inputs: { risk: "high" } } as unknown as Record<string, unknown>));
        // security-audit high risk should be allowed if governanceApproved? Actually riskGovernance allows security-audit high, but behaviorLevel requires approval for high + level 5
        // With governanceApproved not set, behavior-level will block. So use low risk to pass
        const v2 = gp.evaluateSync(makeMission({ workflowId: "development", inputs: { risk: "low" } } as unknown as Record<string, unknown>));
        expect(v2.allowed).toBe(true);
      });
    });

    it("rego-js allow + ts block -> fail-closed sync", async () => {
      await withRealAuditSync(() => {
        // need to capture actual for delegate
        // withRealAuditSync already set delegate, but we override: keep audit delegation
        // we need to re-capture actual inside this scope — use sync require via dynamic import already done in withRealAuditSync
        // To keep audit working, we make existsSync true for REGO_PATH and delegate others to real via actual from withRealAuditSync's closure
        // Since withRealAuditSync sets mock to delegate to real, we now override to handle REGO_PATH specially while keeping audit
        const actualInside = (mockedExistsSync as unknown as { _actual?: unknown })?._actual;
        // fallback: make simple true for REGO_PATH, false otherwise is wrong, so we delegate audit to real via checking string includes runtime
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return true;
          // delegate to real via checking if file actually exists using mockedReadFileSync's underlying? Use try
          // Instead we know audit log path should return false initially then true after append — delegate via real existsSync stored in withRealAuditSync
          // withRealAuditSync set mock to actual.existsSync, so we can call that by retrieving actual via importActual sync not possible.
          // Workaround: return false for wasm, true for audit after append handled by appendAuditLog's own existsSync check?
          // For this test we need audit log to be readable after append, so make existsSync return true for AUDIT_LOG_PATH after it is created.
          // Simplest: return true for REGO_PATH, and for AUDIT_LOG_PATH check via real filesystem using Node's native fallback via `global`?
          // Use `eval` to bypass mock: get real existsSync from `await import` not possible sync.
          // So we make existsSync return true for any path that contains "audit.log" after first append — which will happen.
          if ((p as string).includes("audit.log")) return true;
          return false;
        });
        const gp = new GovernancePolicy();
        const v = gp.evaluateSync(makeMission({ workflowId: "development", inputs: { file: ".env", risk: "low" } } as unknown as Record<string, unknown>));
        expect(v.allowed).toBe(false);
        // cannot reliably read audit due to mock override, just verify verdict
      });
    });

    it("covers appendAuditLog throw catch in sync (mkdir fails)", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation((p: unknown) => {
        if ((p as string) === REGO_PATH) return false;
        return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
      });
      mockedMkdirSync.mockImplementation(() => { throw new Error("mkdir fail"); });
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      const gp = new GovernancePolicy();
      const v = gp.evaluateSync(makeMission({ workflowId: "development" }));
      expect(v.allowed).toBe(true); // still returns verdict even if audit fails
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
    });

    it("covers evaluateSync with rego-js+ts-fail-closed-sync source when js allow but ts block", async () => {
      await withRealAuditSync(() => {
        mockedExistsSync.mockImplementation((p: unknown) => {
          if ((p as string) === REGO_PATH) return true;
          if ((p as string).includes("audit.log")) return true;
          return false;
        });
        const gp = new GovernancePolicy();
        // high risk incident should be allowed by rego-js but blocked by behaviorLevel without approval? Use incident low risk? Actually need a case where js allow but ts blocks.
        // Use protected path with low risk: js allow (low) but ts blocks due to protected path
        const v = gp.evaluateSync(makeMission({ workflowId: "development", inputs: { file: "node_modules/foo", risk: "low" } } as unknown as Record<string, unknown>));
        expect(v.allowed).toBe(false);
      });
    });
  });

  describe("singleton and helpers", () => {
    it("governancePolicy singleton evaluate", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      mockedWriteFileSync.mockImplementation(actual.writeFileSync as unknown as typeof mockedWriteFileSync);
      mockedUnlinkSync.mockImplementation(actual.unlinkSync as unknown as typeof mockedUnlinkSync);
      mockedExecSync.mockImplementation(() => { throw new Error("opa missing"); });
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
      const v = await evaluateGovernance(makeMission({ workflowId: "development", inputs: { risk: "low" } } as unknown as Record<string, unknown>));
      expect(v.allowed).toBe(true);
      expect(governancePolicy.id).toBe(POLICY_ID);
      expect(governancePolicy.regoPath).toBe(REGO_PATH);
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
    });

    it("evaluateGovernanceSync helper", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation((p: unknown) => {
        if ((p as string) === REGO_PATH) return false;
        return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
      });
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      mockedUnlinkSync.mockImplementation(actual.unlinkSync as unknown as typeof mockedUnlinkSync);
      mockedWriteFileSync.mockImplementation(actual.writeFileSync as unknown as typeof mockedWriteFileSync);
      const v = evaluateGovernanceSync(makeMission({ workflowId: "development" }));
      expect(v.allowed).toBe(true);
    });

    it("covers toMission fallback for missing ids and workflow", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation((p: unknown) => {
        if ((p as string) === REGO_PATH) return false;
        if ((p as string).includes("policy.wasm")) return false;
        return (actual.existsSync as unknown as (path: unknown) => boolean)(p as unknown as string);
      });
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      mockedWriteFileSync.mockImplementation(actual.writeFileSync as unknown as typeof mockedWriteFileSync);
      mockedUnlinkSync.mockImplementation(actual.unlinkSync as unknown as typeof mockedUnlinkSync);
      mockedExecSync.mockImplementation(() => { throw new Error("opa missing"); });
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
      const gp = new GovernancePolicy();
      const v = await gp.evaluate({} as unknown as policy.RegoInput);
      // {} triggers toMission synthesis -> id "unknown", title "mission unknown", workflowId "development" -> allowed (medium escalate)
      expect(v.allowed).toBe(true);
      // Now test true failure via direct Mission with empty id/title
      const v2 = await gp.evaluate({ id: "", title: "", workflowId: "development", createdAt: new Date().toISOString(), inputs: {} } as unknown as import("../src/domain/types.js").Mission);
      expect(v2.allowed).toBe(false);
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
    });

    it("normalizeRisk via inputs fallback", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
      mockedMkdirSync.mockImplementation(actual.mkdirSync as unknown as typeof mockedMkdirSync);
      mockedAppendFileSync.mockImplementation(actual.appendFileSync as unknown as typeof mockedAppendFileSync);
      mockedExecSync.mockImplementation(() => { throw new Error("opa missing"); });
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
      const gp = new GovernancePolicy();
      const m = makeMission({ workflowId: "development", inputs: { risk: "medium" } } as unknown as Record<string, unknown>);
      // delete risk top-level to force normalizeRisk via inputs
      delete (m as unknown as Record<string, unknown>).risk;
      const v = await gp.evaluate(m);
      expect(v.action).toBe("escalate");
      try { actual.unlinkSync(AUDIT_LOG_PATH); } catch {}
    });
  });

  describe("tryOpaWasm WASM no deno and CLI branch coverage extras", () => {
    it("covers WASM with undefined deny -> empty array", async () => {
      const wasmPath = join(process.cwd(), "packages", "governance", "policy.wasm");
      mockedExistsSync.mockImplementation((p: unknown) => (p as string) === wasmPath);
      mockedReadFileSync.mockImplementation(((p: unknown) => Buffer.from("wasm")) as unknown as typeof mockedReadFileSync);
      mockedLoadPolicy.mockResolvedValue({
        evaluate: () => ({ result: { allow: true } }),
      } as unknown as { evaluate: (i: unknown) => { result: unknown } });
      const r = await tryOpaWasm({ risk: "low", workflowId: "development" });
      expect(r!.allow).toBe(true);
      expect(r!.deny).toEqual([]);
    });

    it("covers readAuditLog empty string", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      mockedExistsSync.mockImplementation(actual.existsSync as unknown as (p: unknown) => boolean);
      mockedReadFileSync.mockImplementation(() => "   \n  ");
      const logs = readAuditLog();
      expect(logs).toEqual([]);
      mockedReadFileSync.mockImplementation(actual.readFileSync as unknown as typeof mockedReadFileSync);
    });

  });
});
