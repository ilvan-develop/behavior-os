/** Learning Engine — record → detect → auto-apply (LEARN-03)
 * OS learn: define how agents learn from missions.
 * Usa packages/knowledge/memory como store + graphify para detect.
 */
import { remember, recall } from "../../packages/knowledge/memory.js";
import type { Mission } from "../domain/types.js";

export interface LearningEntry {
  missionId: string;
  type: "insight" | "failure" | "success";
  content: string;
  impact: "low" | "medium" | "high";
  timestamp: string;
}

const learnings: LearningEntry[] = [];

export async function recordLearning(entry: Omit<LearningEntry, "timestamp">): Promise<void> {
  const full: LearningEntry = { ...entry, timestamp: new Date().toISOString() };
  learnings.push(full);
  remember({ missionId: entry.missionId, lesson: entry.content, timestamp: full.timestamp, tags: [entry.type, entry.impact] });
}

export function getLearnings(missionId?: string): LearningEntry[] {
  return missionId ? learnings.filter((l) => l.missionId === missionId) : [...learnings];
}

export function detectPatterns(): string[] {
  const patterns: string[] = [];
  if (learnings.filter((l) => l.type === "failure").length >= 2) patterns.push("repeat-failure: auto-apply fix");
  if (learnings.filter((l) => l.impact === "high").length >= 1) patterns.push("high-impact: escalate governance");
  return patterns;
}

export async function createMissionWithLearning(mission: Mission): Promise<Mission> {
  await recordLearning({ missionId: mission.id, type: "success", content: `Mission ${mission.id} created`, impact: "low" });
  return mission;
}
