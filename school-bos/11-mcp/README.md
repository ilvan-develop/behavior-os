# BOS-LESSON-110 — MCP: Marketplace 45 Tools

> Módulo 11 · STABLE · 1.3.0

## Learning objective

Listar e invocar MCP tools: `mission.*`, `evidence.*`, `graph.*` + `behaviorOS` canônica.

## Prerequisites

10 LangGraph

## Concept

MCP = Model Context Protocol. BOS expõe `Marketplace` com 45 tools, `servers` (opencode.json mcp), `tools[].argsShape` non-empty, `validation.valid`. Prova = `behavior-os/runtime/mcp.json` (Regra de Ouro). `behaviorOS` tool é canônica: `argsShape [action, missionId]`.

## Why it matters

MCP é a interface para agentes externos consumirem BOS (mission create, evidence query, graph search).

## BehaviorOS implementation

- `packages/mcp/marketplace.ts` + `packages/mcp/store.ts` — marketplace impl
- `packages/mcp/mcp.ts` — gateway
- `behavior-os/runtime/mcp.json` — `{version, tools[45], servers, validation}`
- `behavior-os/runtime/demo.json:mcp` — snapshot `{exists, toolCount, serverCount, valid}`
- `src/domain/types.ts:69-76` — `Evidence.mcp`
- `src/cli/doctor.ts:106-124` — valida `mcp.json` + `behaviorOS` tool
- `.opencode/tools/behaviorOS.ts` — tool que expõe MCP

## Hands-on

```bash
pnpm demo
cat behavior-os/runtime/mcp.json | python -c "import json; d=json.load(open('behavior-os/runtime/mcp.json')); print(f\"tools={len(d['tools'])} servers={len(d['servers'])} valid={d['validation']['valid']}\"); [print(t['name'], t['argsShape']) for t in d['tools'][:5]]"
cat behavior-os/runtime/mcp.json | grep -A2 behaviorOS
cat .opencode/tools/behaviorOS.ts | head -n 60
```

## OpenCode prompt

```
Leia packages/mcp/marketplace.ts e behavior-os/runtime/mcp.json.
Liste 5 tools (mission.*, evidence.*, graph.*), explique argsShape, e mostre como invocar behaviorOS tool via .opencode/tools/behaviorOS.ts.
Valide com doctor.
```

## Expected result

5 tools com argsShape + invocação exemplo + `doctor mcp PASS`.

## Verification

```bash
pnpm doctor 2>&1 | grep mcp
cat behavior-os/runtime/mcp.json | grep -q '"valid": true' && echo "mcp valid"
cat behavior-os/runtime/demo.json | python -c "import json; print(json.load(open('behavior-os/runtime/demo.json'))['mcp'])"
```

## Common mistakes

- Tool com `argsShape: []` → `doctor` FAIL `mcp.json tools argsShape non-empty`.
- `mcp.json` ausente → `pnpm demo` não rodou.

## Troubleshooting

`mcp.json invalid` → `cat behavior-os/runtime/mcp.json | python -m json.tool` + `packages/mcp/validation`.

## Challenge

Crie via MCP `mission.create` + `evidence.query` e mostre `mcp.invocations` em `demo.json`.

## Completion criteria

Lista 45 tools count + explica `behaviorOS` tool + `doctor mcp PASS`.

## MCP servers (overlay mínimo, sem literais)

| Aspecto | BOS local (`graphify.serve`) | codebase-memory |
|---|---|---|
| Comando | `python -m graphify.serve graphify-out/graph.json` | servidor memória externo (ex: `codebase-memory` MCP) |
| Transporte | stdio default; `--transport http` opcional | http/sse remoto |
| Fonte | `graphify-out/graph.json` local (Regra de Ouro, soberania host) | índice remoto persistido |
| Freshness | `fresh` após `/graphify . --update`; `doctor` valida hash | depende de sync externo |
| Soberania | host mantém `src/`, `graph.json` nunca sobrescrito | risco de sobrescrita — usar só como fallback leitura |
| Quando usar | default BOS (query/path/explain/prs, 10 tools) | fallback quando grafo local ausente |

- Context7 local default em `opencode.json`: `mcp.context7` com `type: "local"`, `command: ["npx", "-y", "@upstash/context7-mcp", "--api-key", "{env:CONTEXT7_API_KEY}"]`, `enabled: true`. Chave via env `CONTEXT7_API_KEY` (ver `.env.example` com `YOUR_API_KEY`), nunca token literal.
- Remoto só como fallback: `type: "remote"` com `Bearer {env:CONTEXT7_API_KEY}` (placeholder `{env:}`, sem literal).
- Graphify local mantido: `command: ["python", "-m", "graphify.serve", "graphify-out/graph.json"]`.
- Windows: se `npx` falhar como bin direto, prefixar `command` com `cmd /c`.
- Refs:
  - https://context7.com/docs/resources/all-clients#opencode
  - https://graphify.com/docs
  - https://github.com/Graphify-Labs/graphify
