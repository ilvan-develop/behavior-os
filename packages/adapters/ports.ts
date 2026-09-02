/** Adapter Ports — core define interfaces, adapters implementam
 * Inversão: core nunca importa opencode directly, só via portas.
 */
export interface ExecutionProvider {
  id: string; // opencode, langgraph
  execute(missionId: string, workflowId: string): Promise<{ status: string }>;
}

export interface KnowledgeProvider {
  id: string; // graphify
  query(question: string): Promise<string>;
  isFunctional(): boolean;
}

export interface EvidenceStore {
  save(missionId: string, evidence: unknown): void;
  load(missionId: string): unknown | null;
}

export interface ModelProvider {
  id: string;
  complete(prompt: string): Promise<string>;
}
