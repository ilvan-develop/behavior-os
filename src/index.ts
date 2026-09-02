/** Barrel público — behaviorOS v1.3.0 ADR 008 — única superfície publicada via package.json exports */
import type { SdkPorts } from "./domain/ports.js";
import type { Mission, Workflow, Evidence } from "./domain/types.js";
import { loadMission, loadWorkflow, validateMission, executeMission } from "./core/mission-engine.js";
import { evidencePath, evidenceLedger } from "./core/evidence-ledger.js";
import { govern } from "./core/governance.js";
import { runWorkflow } from "./workflow/engine.js";
import { recordLearning, detectPatterns as detectPatternsCore } from "./core/learning.js";
import { emit, getEvents, clearEvents } from "../packages/kernel/events.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

// Re-exports de tipos — consumidores usam "behavior-os" ou "behavior-os/ports"
export type { Mission, Workflow, Evidence } from "./domain/types.js";
export type {
  SdkPorts,
  MissionPort,
  WorkflowPort,
  EvidencePort,
  EvidenceLedgerPort,
  LearningPort,
  LearningEntry,
  LearningPattern,
  GovernancePort,
  KernelPort,
  KernelEvent,
} from "./domain/ports.js";

// Factory — compõe implementações reais de src/core e packages, injetável via overrides para testes
export function createSdkPorts(overrides: Partial<SdkPorts> = {}): SdkPorts {
  const mission: SdkPorts["mission"] = overrides.mission ?? {
    load(path: string): Mission {
      return loadMission(path);
    },
    validate(mission: Mission) {
      const v = validateMission(mission) as { allowed: boolean; policyId: string; reasons: string[] };
      return { allowed: v.allowed, policyId: v.policyId, reasons: v.reasons };
    },
    async execute(missionPath: string, workflowPath: string): Promise<Evidence> {
      const res = (await executeMission(missionPath, workflowPath)) as unknown as Evidence | { evidence: Evidence };
      return (res as any).evidence ?? (res as Evidence);
    },
  };

  const workflow: SdkPorts["workflow"] = overrides.workflow ?? {
    load(path: string): Workflow {
      return loadWorkflow(path) as Workflow;
    },
    async run(workflowArg: Workflow, missionArg: Mission): Promise<Evidence> {
      const ledger = evidenceLedger(missionArg, workflowArg);
      const result = await runWorkflow(workflowArg, missionArg, ledger as any);
      return (result as any).evidence ?? result;
    },
    list(): Workflow[] {
      try {
        const dir = join(process.cwd(), "behavior-os", "workflows");
        if (!existsSync(dir)) return [];
        const files = readdirSync(dir).filter((f: string) => f.endsWith(".json"));
        return files.map((f: string) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as Workflow);
      } catch {
        return [];
      }
    },
  };

  const evidence: SdkPorts["evidence"] = overrides.evidence ?? {
    path(missionId: string): string {
      return evidencePath(missionId);
    },
    read(missionId: string): Evidence | null {
      try {
        const p = evidencePath(missionId);
        if (!existsSync(p)) return null;
        return JSON.parse(readFileSync(p, "utf-8")) as Evidence;
      } catch {
        return null;
      }
    },
    write(evidenceArg: Evidence): void {
      const p = evidencePath(evidenceArg.missionId);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(evidenceArg, null, 2), "utf-8");
    },
    ledger(missionArg: Mission, workflowArg: Workflow) {
      return evidenceLedger(missionArg, workflowArg) as unknown as import("./domain/ports.js").EvidenceLedgerPort;
    },
  };

  const learning: SdkPorts["learning"] = overrides.learning ?? {
    async record(entry: import("./domain/ports.js").LearningEntry): Promise<void> {
      await recordLearning({
        missionId: entry.missionId,
        type: "insight",
        content: entry.signal,
        impact: "low",
      } as any);
    },
    async detectPatterns(_missionId: string): Promise<import("./domain/ports.js").LearningPattern[]> {
      const patterns = detectPatternsCore() as unknown as string[];
      return patterns.map((p, i) => ({ id: `p-${i}`, signal: p, count: 1 }));
    },
  };

  const governance: SdkPorts["governance"] = overrides.governance ?? {
    check(missionArg: Mission) {
      const v = govern(missionArg) as { allowed: boolean; action: string; policyId: string; reasons: string[] };
      const action = v.action === "block" ? "block" : v.action === "warn" || v.action === "escalate" ? "warn" : "pass";
      return { allowed: v.allowed, action: action as "block" | "pass" | "warn", policyId: v.policyId, reasons: v.reasons };
    },
  };

  const kernel: SdkPorts["kernel"] = overrides.kernel ?? {
    emit(event: import("./domain/ports.js").KernelEvent): void {
      emit(event as any);
    },
    getEvents(missionId: string) {
      return getEvents(missionId) as unknown as import("./domain/ports.js").KernelEvent[];
    },
    clearEvents(_missionId?: string): void {
      clearEvents();
    },
  };

  return { mission, workflow, evidence, learning, governance, kernel };
}
