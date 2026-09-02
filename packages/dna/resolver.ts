/** DNA Resolver — herança System → Project → Workflow + Agent → Effective DNA
 * DNA é transversal: System + Project + Workflow + Agent → Action
 */
import type { AnyDna } from "./schema.js";
import { loadSystemDna, loadProjectDna, loadAgentDna, loadWorkflowDna } from "./loader.js";

export interface EffectiveDna {
  system: AnyDna | null;
  project: AnyDna | null;
  workflow: AnyDna | null;
  agent: AnyDna | null;
  principles: string[];
  invariants: string[];
  rules: Record<string, unknown>;
}

export function resolveDna(agent: string, workflow: string, root = process.cwd()): EffectiveDna {
  const system = loadSystemDna(root);
  const project = loadProjectDna(root);
  const wf = loadWorkflowDna(workflow, root);
  const ag = loadAgentDna(agent, root);
  const principles = [
    ...((system as any)?.principles ?? []),
    ...((project as any)?.principles ?? []),
    ...((wf as any)?.principles ?? []),
    ...((ag as any)?.principles ?? []),
  ];
  const invariants = [
    ...((system as any)?.invariants ?? []),
    ...((project as any)?.invariants ?? []),
    ...((wf as any)?.invariants ?? []),
    ...((ag as any)?.invariants ?? []),
  ];
  const rules = {
    ...((system as any)?.rules ?? {}),
    ...((project as any)?.rules ?? {}),
    ...((wf as any)?.rules ?? {}),
    ...((ag as any)?.rules ?? {}),
  };
  return { system, project, workflow: wf, agent: ag, principles: [...new Set(principles)], invariants: [...new Set(invariants)], rules };
}

export function checkInvariant(effective: EffectiveDna, invariant: string): boolean {
  return effective.invariants.includes(invariant);
}
