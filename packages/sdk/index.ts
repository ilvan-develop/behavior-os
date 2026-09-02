/** SDK @behavior-os/sdk — ADR 008 — Sdk Port sem ../../src */
import type { SdkPorts, Mission, Evidence } from "behavior-os/ports";
import { createSdkPorts } from "behavior-os";

export class BehaviorOS {
  constructor(private readonly ports: SdkPorts = createSdkPorts()) {}

  async createMission(mission: Mission): Promise<Mission> {
    return mission;
  }

  async startMission(missionId: string, workflowId = "development"): Promise<Evidence> {
    return this.ports.mission.execute(
      `behavior-os/missions/${missionId}.json`,
      `behavior-os/workflows/${workflowId}.json`
    );
  }

  async recordLearning(entry: { missionId: string; signal: string }): Promise<void> {
    return this.ports.learning.record({ ...entry, timestamp: new Date().toISOString() });
  }

  getEvidence(missionId: string): Evidence | null {
    return this.ports.evidence.read(missionId);
  }
}

// Re-exports úteis para consumidores que queiram criar ports custom
export { createSdkPorts } from "behavior-os";
export type { SdkPorts, Mission, Evidence } from "behavior-os/ports";
