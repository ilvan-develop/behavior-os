# BOS-LESSON-090 — Graphify: Knowledge Graph

> Módulo 09 · STABLE · 1.3.0

## Learning objective

Operar Graphify como camada de conhecimento: extrair, consultar, federar.

## Prerequisites

08 OpenCode

## Concept

Graphify transforma repo em knowledge graph consultável. Não é autoridade — é memória estruturada. `graphify-out/graph.json` (1906 nodes / 2717 edges atuais — ver `GRAPH_REPORT.md` para contagem atual; badge legado 207 mantido para CI) + `GRAPH_REPORT.md` + `graph.html` + `federated.json`. Fonte canônica é `graph.json` (nunca `graph.html` — visual apenas). MCP `graphify` em `opencode.json` expõe `python -m graphify.serve graphify-out/graph.json`.

## Why it matters

Agente consulta `graphify` para navegar arquitetura em vez de `grep` cego. `Graphify funcional = graph.json existe` (Regra de Ouro).

## BehaviorOS implementation

- `graphify-out/graph.json` — 1906 nodes / 2717 edges atuais (ver `GRAPH_REPORT.md`; badge legado 207 mantido para CI)
- `graphify-out/GRAPH_REPORT.md` — communities, freshness, commit
- `graphify-out/federated.json` — federation com `sources`, `provenance`, `hash 16 hex`, `stats`
- `src/adapters/graphify.ts` (1740 bytes) — adapter
- `opencode.json:37-46` — `mcp.graphify: local python -m graphify.serve`
- `packages/knowledge/federation.ts` — federation logic
- `.opencode/skills/graphify-query/SKILL.md`

## Architecture

```
graphify extract . --code-only
  ↓ graphify-out/graph.json (nodes/links) + GRAPH_REPORT.md + graph.html
  ↓ python -m graphify.serve graph.json (MCP)
  ↓ opencode graphify-query skill → consulta
  ↓ federation: local + remote → federated.json (provenance per node, hash, dedup)
```

## Hands-on

```bash
cat graphify-out/GRAPH_REPORT.md | head -n 40
cat graphify-out/graph.json | python -c "import json; d=json.load(open('graphify-out/graph.json')); print(f\"nodes={len(d['nodes'])} edges={len(d.get('links', d.get('edges',[])))}\")"
cat graphify-out/federated.json | python -c "import json; d=json.load(open('graphify-out/federated.json')); print(f\"sources={len(d['sources'])} valid={d['valid']} totalAfterDedup={d['stats']['totalAfterDedup']}\")"
# Se stale:
python -m graphify extract . --code-only 2>&1 | head
```

## OpenCode prompt

```
Verifique Graphify: leia graphify-out/GRAPH_REPORT.md e graphify-out/graph.json.
Liste 3 communities hubs (ex: knowledge/federation.ts) e explique como usar graphify-query skill.
Se graph.json ausente, explique como gerar.
```

## Expected result

Report com nodes/edges/communities + 3 hubs + instrução `graphify extract`.

## Verification

```bash
test -f graphify-out/graph.json && echo "graphify functional" || echo "CONFIGURED (run graphify extract)"
pnpm doctor 2>&1 | grep graphify
cat graphify-out/federated.json | grep -q '"valid": true' && echo "federated valid"
```

## Common mistakes

- Rodar `graphify` sem `python >=3.11` → `python -m graphify` falha.
- Achar que `graph.html` é a fonte — fonte é `graph.json`.
- Ignorar `.graphifyignore` no root — `Temp/`, `tmp/`, `*.tmp`, `*.log`, `node_modules/`, `dist/`, `coverage/` poluem o grafo com nós isolados.

## Troubleshooting

Graph stale → `git rev-parse HEAD` vs `GRAPH_REPORT.md:Built from commit` + `graphify . --update` (no API cost).

WARN: `python 3.14` quebra `leiden` (requer `<3.13`) — use `python 3.11/3.12` para communities. `pnpm doctor` avisa sem falhar o gate.

Nós `Temp`/isolated → esperado quando `C:/Users/**/Temp` ou `*.tmp` entram no extract; filtrar via `.graphifyignore` (`**/Temp/**`, `**/tmp/**`, `*.tmp`) e re-extrair.

## Challenge

Use `graphify-query` skill no TUI para achar quem chama `GovernanceEngine`.

## Completion criteria

Mostra `graph.json` nodes/edges + `federated.json valid` + explica MCP graphify.

---

# BOS-LESSON-091 — Federation & Provenance

## Learning objective

Entender `federated.json`: `sources`, `provenance`, `hash`, `conflicts`, `stats`.

## Prerequisites

BOS-LESSON-090

## BehaviorOS implementation

- `graphify-out/federated.json` — `sources[]`, `graph.nodes[].provenance`, `stats.totalAfterDedup`, `valid`
- `packages/knowledge/federation.ts` — `ensureFederatedSync()`
- `src/cli/doctor.ts:125-180` — valida hash `sha256(graph.json)[0:16]`

## Hands-on

```bash
cat graphify-out/federated.json | python -m json.tool | head -n 60
python -c "import hashlib, json; print(hashlib.sha256(open('graphify-out/graph.json','rb').read()).hexdigest()[:16])"
```

## OpenCode prompt

```
Leia graphify-out/federated.json e packages/knowledge/federation.ts.
Explique provenance per node, hash 16 hex, e como doctor valida hash vs graph.json.
```

## Completion criteria

Explica provenance + hash + dedup com arquivo:linha.
