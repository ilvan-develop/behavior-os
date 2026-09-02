/** DNA Schema — v2.1
 * System, Project, Agent, Workflow DNAs com invariantes.
 */
export type DnaKind = "system" | "project" | "agent" | "workflow";
export interface DnaBase {
    kind: DnaKind;
    version: string;
    identity?: string;
    principles?: string[];
    invariants?: string[];
    rules?: Record<string, unknown>;
}
export interface SystemDna extends DnaBase {
    kind: "system";
    identity: string;
    principles: string[];
    invariants: string[];
}
export interface ProjectDna extends DnaBase {
    kind: "project";
    project: {
        name: string;
        type: string;
        stack?: Record<string, string>;
        architecture?: Record<string, unknown>;
    };
    rules?: {
        coverage_minimum?: number;
        require_security_review?: boolean;
        [k: string]: unknown;
    };
}
export interface AgentDna extends DnaBase {
    kind: "agent";
    agent: string;
    behavior?: Record<string, string>;
}
export interface WorkflowDna extends DnaBase {
    kind: "workflow";
    workflow: string;
    behaviorLevel?: number;
}
export type AnyDna = SystemDna | ProjectDna | AgentDna | WorkflowDna;
