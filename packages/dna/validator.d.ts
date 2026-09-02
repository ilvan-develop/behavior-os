/** DNA Validator — garante que invariantes não são violados */
import type { EffectiveDna } from "./resolver.js";
export interface ValidationResult {
    valid: boolean;
    violations: string[];
}
export declare function validateDna(effective: EffectiveDna): ValidationResult;
export declare function assertDna(effective: EffectiveDna): void;
