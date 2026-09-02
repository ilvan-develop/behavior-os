/** Graphify Adapter — implementa KnowledgeProvider */
import type { KnowledgeProvider } from "./ports.js";
import { graphifyStatus, graphifyMcpCommand } from "../../src/adapters/graphify.js";

export const graphifyAdapter: KnowledgeProvider = {
  id: "graphify",
  async query(question: string) {
    const s = graphifyStatus();
    if (!s.functional) throw new Error("graphify not functional — run graphify extract");
    return `query "${question}" over ${s.nodeCount} nodes via ${graphifyMcpCommand().join(" ")}`;
  },
  isFunctional() {
    return graphifyStatus().functional;
  },
};
