import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BehaviorOS, createSdkPorts } from "../packages/sdk/index.js";
import { createSdkPorts as coreCreateSdkPorts } from "behavior-os";
import type { Mission, Evidence, SdkPorts } from "behavior-os/ports";

function makeMission(over: Partial<Mission> = {}): Mission {
  return {
    id: "m1",
    title: "Test Mission",
    goal: "test goal",
    workflowId: "development",
    createdAt: new Date().toISOString(),
    inputs: {},
    ...over,
  };
}

function makeEvidence(over: Partial<Evidence> = {}): Evidence {
  return {
    missionId: "m1",
    workflowId: "development",
    status: "COMPLETED",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    stages: [],
    governance: { policyId: "default", verdict: "pass", reasons: [] },
    ...over,
  };
}

function makeMockPorts(evidence: Evidence = makeEvidence()): SdkPorts {
  return {
    mission: {
      load: vi.fn(),
      validate: vi.fn(),
      execute: vi.fn().mockResolvedValue(evidence),
    },
    workflow: {
      load: vi.fn(),
      run: vi.fn(),
      list: vi.fn().mockReturnValue([]),
    },
    evidence: {
      path: vi.fn(),
      read: vi.fn(),
      write: vi.fn(),
      ledger: vi.fn(),
    },
    learning: {
      record: vi.fn().mockResolvedValue(undefined),
      detectPatterns: vi.fn().mockResolvedValue([]),
    },
    governance: {
      check: vi.fn(),
    },
    kernel: {
      emit: vi.fn(),
      getEvents: vi.fn().mockReturnValue([]),
      clearEvents: vi.fn(),
    },
  } as unknown as SdkPorts;
}

describe("sdk — BehaviorOS 95% coverage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("instantiates with default ports when no arg", () => {
    const sdk = new BehaviorOS();
    expect(sdk).toBeInstanceOf(BehaviorOS);
    // getEvidence delegates to real ports.evidence.read which returns null for missing file
    expect(sdk.getEvidence("non-existent-mission-xyz")).toBeNull();
  });

  it("instantiates with custom ports", () => {
    const ports = makeMockPorts();
    const sdk = new BehaviorOS(ports);
    expect(sdk).toBeInstanceOf(BehaviorOS);
    // ensure custom ports are used
    (ports.evidence.read as ReturnType<typeof vi.fn>).mockReturnValue(makeEvidence({ missionId: "custom" }));
    expect(sdk.getEvidence("custom")?.missionId).toBe("custom");
  });

  it("createMission returns same mission (identity)", async () => {
    const ports = makeMockPorts();
    const sdk = new BehaviorOS(ports);
    const mission = makeMission({ id: "m-create" });
    const result = await sdk.createMission(mission);
    expect(result).toBe(mission);
    expect(result).toEqual(mission);
  });

  it("createMission handles different mission shapes", async () => {
    const ports = makeMockPorts();
    const sdk = new BehaviorOS(ports);
    const mission = makeMission({ id: "m2", title: "Another", inputs: { foo: "bar", nested: { a: 1 } } });
    await expect(sdk.createMission(mission)).resolves.toEqual(mission);
  });

  it("startMission uses default workflowId development and correct paths", async () => {
    const evidence = makeEvidence({ missionId: "m-default", workflowId: "development" });
    const ports = makeMockPorts(evidence);
    const sdk = new BehaviorOS(ports);
    const result = await sdk.startMission("m-default");
    expect(ports.mission.execute).toHaveBeenCalledTimes(1);
    expect(ports.mission.execute).toHaveBeenCalledWith(
      "behavior-os/missions/m-default.json",
      "behavior-os/workflows/development.json"
    );
    expect(result).toEqual(evidence);
  });

  it("startMission with explicit workflowId", async () => {
    const evidence = makeEvidence({ missionId: "m-custom", workflowId: "research" });
    const ports = makeMockPorts(evidence);
    const sdk = new BehaviorOS(ports);
    const result = await sdk.startMission("m-custom", "research");
    expect(ports.mission.execute).toHaveBeenCalledWith(
      "behavior-os/missions/m-custom.json",
      "behavior-os/workflows/research.json"
    );
    expect(result).toEqual(evidence);
  });

  it("startMission with security-audit workflowId", async () => {
    const evidence = makeEvidence({ missionId: "m-sec", workflowId: "security-audit" });
    const ports = makeMockPorts(evidence);
    const sdk = new BehaviorOS(ports);
    await sdk.startMission("m-sec", "security-audit");
    expect(ports.mission.execute).toHaveBeenCalledWith(
      "behavior-os/missions/m-sec.json",
      "behavior-os/workflows/security-audit.json"
    );
  });

  it("startMission propagates execute rejection", async () => {
    const ports = makeMockPorts();
    (ports.mission.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("execute failed"));
    const sdk = new BehaviorOS(ports);
    await expect(sdk.startMission("fail")).rejects.toThrow("execute failed");
  });

  it("recordLearning adds ISO timestamp and delegates", async () => {
    vi.useFakeTimers();
    const fixedDate = new Date("2026-01-15T12:34:56.000Z");
    vi.setSystemTime(fixedDate);

    const ports = makeMockPorts();
    const sdk = new BehaviorOS(ports);
    await sdk.recordLearning({ missionId: "m1", signal: "test-signal" });

    expect(ports.learning.record).toHaveBeenCalledTimes(1);
    const arg = (ports.learning.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.missionId).toBe("m1");
    expect(arg.signal).toBe("test-signal");
    expect(arg.timestamp).toBe("2026-01-15T12:34:56.000Z");
    // ensure timestamp is valid ISO
    expect(() => new Date(arg.timestamp)).not.toThrow();
    expect(new Date(arg.timestamp).toISOString()).toBe(arg.timestamp);
  });

  it("recordLearning preserves entry spread and creates new object", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-02T00:00:00.000Z"));
    const ports = makeMockPorts();
    const sdk = new BehaviorOS(ports);
    const entry = { missionId: "m2", signal: "signal-2" };
    await sdk.recordLearning(entry);
    const called = (ports.learning.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(called).toEqual({ missionId: "m2", signal: "signal-2", timestamp: "2026-02-02T00:00:00.000Z" });
    // ensure original not mutated
    expect(entry).toEqual({ missionId: "m2", signal: "signal-2" });
  });

  it("recordLearning returns void promise", async () => {
    const ports = makeMockPorts();
    const sdk = new BehaviorOS(ports);
    const res = await sdk.recordLearning({ missionId: "m1", signal: "s" });
    expect(res).toBeUndefined();
  });

  it("getEvidence returns Evidence when exists", () => {
    const evidence = makeEvidence({ missionId: "found" });
    const ports = makeMockPorts();
    (ports.evidence.read as ReturnType<typeof vi.fn>).mockReturnValue(evidence);
    const sdk = new BehaviorOS(ports);
    expect(sdk.getEvidence("found")).toEqual(evidence);
    expect(ports.evidence.read).toHaveBeenCalledWith("found");
  });

  it("getEvidence returns null when missing", () => {
    const ports = makeMockPorts();
    (ports.evidence.read as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const sdk = new BehaviorOS(ports);
    expect(sdk.getEvidence("missing")).toBeNull();
    expect(ports.evidence.read).toHaveBeenCalledWith("missing");
  });

  it("getEvidence delegates exactly once per call", () => {
    const ports = makeMockPorts();
    (ports.evidence.read as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const sdk = new BehaviorOS(ports);
    sdk.getEvidence("a");
    sdk.getEvidence("b");
    expect(ports.evidence.read).toHaveBeenCalledTimes(2);
    expect(ports.evidence.read).toHaveBeenNthCalledWith(1, "a");
    expect(ports.evidence.read).toHaveBeenNthCalledWith(2, "b");
  });

  it("re-export createSdkPorts from sdk is same as core", () => {
    expect(createSdkPorts).toBe(coreCreateSdkPorts);
  });

  it("re-exported createSdkPorts creates valid SdkPorts", () => {
    const ports = createSdkPorts();
    expect(ports).toHaveProperty("mission");
    expect(ports).toHaveProperty("workflow");
    expect(ports).toHaveProperty("evidence");
    expect(ports).toHaveProperty("learning");
    expect(ports).toHaveProperty("governance");
    expect(ports).toHaveProperty("kernel");
    // mission port shape
    expect(typeof ports.mission.execute).toBe("function");
    expect(typeof ports.evidence.read).toBe("function");
    expect(typeof ports.learning.record).toBe("function");
  });

  it("re-exported createSdkPorts respects overrides", () => {
    const customEvidence: SdkPorts["evidence"] = {
      path: vi.fn().mockReturnValue("/tmp/custom.json"),
      read: vi.fn().mockReturnValue(makeEvidence({ missionId: "overridden" })),
      write: vi.fn(),
      ledger: vi.fn(),
    } as unknown as SdkPorts["evidence"];
    const ports = createSdkPorts({ evidence: customEvidence });
    expect(ports.evidence).toBe(customEvidence);
    expect(ports.evidence.read("overridden")?.missionId).toBe("overridden");
  });

  it("BehaviorOS works end-to-end with re-exported createSdkPorts + overrides", async () => {
    const evidence = makeEvidence({ missionId: "e2e", workflowId: "development" });
    const mockMissionExecute = vi.fn().mockResolvedValue(evidence);
    const ports = createSdkPorts({
      mission: {
        load: vi.fn(),
        validate: vi.fn(),
        execute: mockMissionExecute,
      } as unknown as SdkPorts["mission"],
      evidence: {
        path: vi.fn(),
        read: vi.fn().mockReturnValue(evidence),
        write: vi.fn(),
        ledger: vi.fn(),
      } as unknown as SdkPorts["evidence"],
      learning: {
        record: vi.fn().mockResolvedValue(undefined),
        detectPatterns: vi.fn(),
      } as unknown as SdkPorts["learning"],
    });
    const sdk = new BehaviorOS(ports);
    const started = await sdk.startMission("e2e");
    expect(started).toEqual(evidence);
    expect(mockMissionExecute).toHaveBeenCalledWith(
      "behavior-os/missions/e2e.json",
      "behavior-os/workflows/development.json"
    );
    expect(sdk.getEvidence("e2e")).toEqual(evidence);
    await sdk.recordLearning({ missionId: "e2e", signal: "done" });
    expect(ports.learning.record).toHaveBeenCalled();
  });
});
