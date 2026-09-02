/** Behavior Kernel — four behavioral families.
 * Único arquivo que define Atomic/Animal/Celestial/Military.
 */
import type { Behavior } from "../domain/types.js";

export const atomicBehaviors: Behavior[] = [
  { kind: "atomic", name: "observe", description: "Collect repo facts without mutation", riskLevel: "low" },
  { kind: "atomic", name: "compare", description: "Diff two states or outputs", riskLevel: "low" },
];

export const animalBehaviors: Behavior[] = [
  { kind: "animal", name: "forage", description: "Parallel search across files (explore)", riskLevel: "low" },
  { kind: "animal", name: "flock", description: "Coordinate multiple agents on same goal", riskLevel: "medium" },
];

export const celestialBehaviors: Behavior[] = [
  { kind: "celestial", name: "orbit", description: "Periodic check of evidence and health", riskLevel: "low" },
  { kind: "celestial", name: "eclipse", description: "Gate that blocks when governance fails", riskLevel: "high" },
];

export const militaryBehaviors: Behavior[] = [
  { kind: "military", name: "secure", description: "Enforce policy before execution", riskLevel: "medium" },
  { kind: "military", name: "audit", description: "Verify evidence completeness", riskLevel: "medium" },
];

export function allBehaviors(): Behavior[] {
  return [...atomicBehaviors, ...animalBehaviors, ...celestialBehaviors, ...militaryBehaviors];
}

export function getBehavior(name: string): Behavior | undefined {
  return allBehaviors().find((b) => b.name === name);
}
