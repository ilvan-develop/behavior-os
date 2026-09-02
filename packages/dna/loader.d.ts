import type { AnyDna } from "./schema.js";
export declare function loadSystemDna(root?: string): AnyDna | null;
export declare function loadProjectDna(root?: string): AnyDna | null;
export declare function loadAgentDna(agent: string, root?: string): AnyDna | null;
export declare function loadWorkflowDna(workflow: string, root?: string): AnyDna | null;
export declare function listAgentDnas(root?: string): string[];
