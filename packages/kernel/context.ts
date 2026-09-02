import { graphifyStatus } from "../../src/adapters/graphify.js";
import type { Mission } from "../../src/domain/types.js";

export interface AgentContext {
  mission: Mission;
  stage: string;
  graphSummary: { exists: boolean; nodeCount?: number; freshness?: string };
  memory: string[];
  invariants: string[];
}

export function buildContext(mission: Mission, stage: string, invariants: string[] = []): AgentContext {
  const g = graphifyStatus();
  return {
    mission,
    stage,
    graphSummary: { exists: g.functional, nodeCount: g.nodeCount, freshness: g.freshness },
    memory: [],
    invariants,
  };
}
