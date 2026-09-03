---
name: graphify-query
description: Use when graphify-query is needed (auto-evolved by Behavior OS)
---

# graphify-query

Use when querying the Graphify knowledge graph (repo memory): `query`/`path`/`explain`/`prs`, MCP 10 tools, incremental update.

Canônico: https://graphify.com/docs

## Install (sem daemon global)

```bash
uv tool install graphifyy
graphify --help
```

> Compat: `leiden` exige `python<3.13` (leiden<3.13). Se `uv` falhar com `leiden` em 3.13+, use `python=3.12`.
> IDE skills: `npx skills add graphify` (agentskills.io progressive disclosure: Discovery → Activation → Execution).

## Extract / update (Regra de Ouro)

```bash
/graphify .
/graphify . --update
python -m graphify extract . --code-only
python -m graphify update .
graphify hook install
```

> Hook opcional — documentado aqui apenas como automação local de update; nunca força commit hooks no host (`core.hooksPath`/husky não são alterados pelo overlay).

- Full: `/graphify .` → `graphify-out/graph.json`
- Incremental sem custo API: `/graphify . --update`
- `graphify functional` = `graphify-out/graph.json` existe.

## Query / path / explain / prs (CLI)

```bash
graphify query "show auth flow" --graph graphify-out/graph.json
graphify query "who calls GovernanceEngine" --graph graphify-out/graph.json --dfs
graphify path src/core/governance.ts src/domain/types.ts --graph graphify-out/graph.json
graphify explain packages/mcp/marketplace.ts --graph graphify-out/graph.json
graphify query "list open prs impacting auth" --graph graphify-out/graph.json
```

- `--dfs` para busca profunda; sem flag para BFS padrão.
- `path` = `shortest_path`; `explain` = `get_node` + `get_neighbors` + `get_community`; `prs` = `list_prs`/`get_pr_impact`/`triage_prs`.

## Serve (MCP local, stdio default)

```bash
python -m graphify.serve graphify-out/graph.json
python -m graphify.serve graphify-out/graph.json --transport http
```

`opencode.json:mcp.graphify` usa stdio (`command: ["python","-m","graphify.serve","graphify-out/graph.json"]`).

## MCP 10 tools

`query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, `shortest_path`, `list_prs`, `get_pr_impact`, `triage_prs`.

## MCP (overlay mínimo, sem literais)

- Context7 local default em `opencode.json`: `mcp.context7` com `type: "local"`, `command: ["npx", "-y", "@upstash/context7-mcp", "--api-key", "{env:CONTEXT7_API_KEY}"]`, `enabled: true`. Chave via env `CONTEXT7_API_KEY` (ver `.env.example` com `YOUR_API_KEY`), nunca token literal.
- Remoto só como fallback: `type: "remote"` com `Bearer {env:CONTEXT7_API_KEY}` (placeholder `{env:}`, sem literal).
- Graphify local mantido: `command: ["python", "-m", "graphify.serve", "graphify-out/graph.json"]`.
- Windows: se `npx` falhar como bin direto, prefixar `command` com `cmd /c`.
- Refs:
  - https://context7.com/docs/resources/all-clients#opencode
  - https://graphify.com/docs
  - https://github.com/Graphify-Labs/graphify
