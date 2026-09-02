# Integration Contracts — behavior-os

| Integração | Configuração | Funcional (evidência) | Versão |
|---|---|---|---|
| OpenCode | `opencode.json` + `.opencode/agents|skills|tools|plugins` | `opencode debug config` sem erro | v1.1 |
| Graphify | `mcp.graphify: {type:local, command:[python,-m,graphify.serve,graphify-out/graph.json]}` | `graphify-out/graph.json` existe com 207 nodes, doctor mostra `functional — 207 nodes` + `query_graph` responde | **v1.2 REAL** |
| LangGraph | `src/adapters/langgraph.ts` gate | `StateGraph` compiled + checkpoint test e2e | v1.3 |
| Evidence | `behavior-os/runtime/*.json` writes | `status: COMPLETED` + `graphify.nodeCount` | v1.2 |

Nenhuma integração é marcada funcional sem evidência observável.
