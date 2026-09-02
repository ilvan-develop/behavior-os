# Research — base documental (2026-09-02)

## OpenCode (opencode.ai/docs + config.json + debug skill)

- Versão local: 1.18.16. Config estrita em `https://opencode.ai/config.json`.
- `AGENTS.md` na raiz, fallback `CLAUDE.md`. `instructions: ["AGENTS.md"]`.
- Agentes: `.opencode/agents/*.md` (mode primary|subagent|all), 4 built-ins (build, plan, general, explore).
- Skills: `.opencode/skills/<name>/SKILL.md` com `name` + `description` obrigatórios.
- Tools: `.opencode/tools/*.ts` via `tool()` helper, filename = tool name.
- Plugins: `.opencode/plugins/*.ts` auto-load, hooks `tool.execute.before`, `session.idle`, `shell.env`.
- MCP: `mcp: { name: { type:"local", command:["..."] } }` — Graphify via `python -m graphify.serve`.
- Permissões: `permission: { tool: "allow"|"ask"|"deny" | { pattern: action } }`, última regra vence.

## Graphify

- `graphify install` + `/graphify .` → `graphify-out/graph.json`. Incremental `--update`, hooks `graphify hook install`.
- MCP 10 tools: query_graph, get_node, get_neighbors, get_community, god_nodes, graph_stats, shortest_path, list_prs, get_pr_impact, triage_prs.
- Serve: `python -m graphify.serve graphify-out/graph.json` (stdio) ou `--transport http`.
- Proveniência: EXTRACTED/INFERRED/AMBIGUOUS.

## LangGraph

- StateGraph + nodes + edges + compile + checkpointer (InMemorySaver dev, Postgres prod). v0.6 introduz `Runtime<Context>` e `durability: exit|async|sync`. TS parity em `@langchain/langgraph`.

## Antropic workflows

- Prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer. Workflows (engineer-owned) vs agents (model-owned). Avaliações obrigatórias.
