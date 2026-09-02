/** SDK @behavior-os/sdk — LEARN-08 — ideia #7 brainstorm */
import { executeMission } from "../../src/core/mission-engine.js";
import { recordLearning } from "../../src/core/learning.js";

export class BehaviorOS {
  constructor(private opts: { dnaPath?: string } = {}) {}
  async createMission(mission: any) { return mission; }
  async startMission(missionId: string, workflowId = "development") {
    return executeMission(`behavior-os/missions/${missionId}.json`, `behavior-os/workflows/${workflowId}.json`);
  }
  async recordLearning(entry: any) { return recordLearning(entry); }
}
