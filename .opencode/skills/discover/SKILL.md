---
name: discover
description: Use when exploring codebase, repo-observe or discovery before planning. Triggers on discover, explore, research, graphify, knowledge graph.
---

# Discover — repo-observe (v1.2 Real Graphify)

Collect facts without mutation. Priority order:
1. If `graphify-out/graph.json` functional (207 nodes verified), use MCP tools `query_graph` (BFS/DFS, budget 2000), `get_node`, `get_neighbors`, `shortest_path` instead of grepping. Relations have provenance `EXTRACTED | INFERRED | AMBIGUOUS` — treat INFERRED as hint, not authority.
2. Fallback to `read/glob/grep`.

Produce findings with `file:line` refs + graph node ids. Never edit. After code changes, check `graphify freshness` and recommend `/graphify . --update` if stale.
