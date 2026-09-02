/** Knowledge Retrieval — junta Knowledge + Memory + Evidence para Context */
import { recall } from "./memory.js";
import { knowledgeGraphSummary } from "./graph.js";
export interface RetrievalResult {
    graph: ReturnType<typeof knowledgeGraphSummary>;
    memory: ReturnType<typeof recall>;
    evidenceCount: number;
}
export declare function retrieve(missionId: string): RetrievalResult;
