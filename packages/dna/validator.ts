/** DNA Validator — garante que invariantes não são violados */
import type { EffectiveDna } from "./resolver.js";

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

export function validateDna(effective: EffectiveDna): ValidationResult {
  const violations: string[] = [];
  // System invariants são inegociáveis
  if (effective.system && !effective.system) violations.push("missing system dna");
  // Exemplo: every_mission_has_evidence deve estar presente
  const required = ["every_mission_has_evidence", "no_unverified_completion"];
  for (const inv of required) {
    if (!effective.invariants.includes(inv)) violations.push(`missing required invariant: ${inv}`);
  }
  return { valid: violations.length === 0, violations };
}

export function assertDna(effective: EffectiveDna): void {
  const r = validateDna(effective);
  if (!r.valid) throw new Error(`DNA violations: ${r.violations.join("; ")}`);
}
