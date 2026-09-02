/** Knowledge Retrieval — junta Knowledge + Memory + Evidence para Context */
import { recall } from "./memory.js";
import { knowledgeGraphSummary } from "./graph.js";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface RetrievalResult {
  graph: ReturnType<typeof knowledgeGraphSummary>;
  memory: ReturnType<typeof recall>;
  evidenceCount: number;
}

export function retrieve(missionId: string): RetrievalResult {
  let evidenceCount = 0;
  try {
    const dir = join(process.cwd(), "behavior-os", "runtime");
    if (existsSync(dir)) evidenceCount = readdirSync(dir).filter((f: string) => f.endsWith(".json")).length;
  } catch {}
  return { graph: knowledgeGraphSummary(), memory: recall(missionId), evidenceCount };
}
