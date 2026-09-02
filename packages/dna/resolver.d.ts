/** DNA Resolver — herança System → Project → Workflow + Agent → Effective DNA
 * DNA é transversal: System + Project + Workflow + Agent → Action
 */
import type { AnyDna } from "./schema.js";
export interface EffectiveDna {
    system: AnyDna | null;
    project: AnyDna | null;
    workflow: AnyDna | null;
    agent: AnyDna | null;
    principles: string[];
    invariants: string[];
    rules: Record<string, unknown>;
}
export declare function resolveDna(agent: string, workflow: string, root?: string): EffectiveDna;
export declare function checkInvariant(effective: EffectiveDna, invariant: string): boolean;
