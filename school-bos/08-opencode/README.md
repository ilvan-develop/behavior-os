# BOS-LESSON-080 — OpenCode: Agents, Skills, Tools, Plugins

> Módulo 08 · STABLE · 1.3.0

## Learning objective

Mapear superfície nativa OpenCode e como o BOS a estende.

## Prerequisites

07 Learning

## Concept

OpenCode = superfície de execução (TUI 1.18.16, headless, MCP). Estrutura nativa (AGENTS.md): `agents` (mode primary|subagent|all), `skills/SKILL.md`, `tools/*.ts` (filename vira tool), `plugins/*.ts` (auto-load), `mcp` em `opencode.json`, `commands/*.md` ou `command:{}`.

BOS estende com 8 agents, 9 skills, 1 tool (`behaviorOS.ts`), 1 plugin (`behaviorOS.ts` v1→v2 `Plugin.define`), 2 commands (`doctor`, `demo`), `permission: "*": "allow"`.

## Why it matters

`permission: "*": "allow"` + plugin `tool.execute.before` = auto-approve `warn|log`, humano só para `block|escalate`. Sem entender, você vive no `ask` infinito.

## BehaviorOS implementation

- `opencode.json:1-67` — `$schema`, `model`, `permission`, `mcp.graphify+context7`, `command`, `plugin`
- `.opencode/agents/*.md` (8): architect, implementer, orchestrator, planner, qa, researcher, reviewer, security
- `.opencode/skills/*/SKILL.md` (9): architecture, behavioros, discover, evidence, graphify-query, implementation, planning, security, verification (+ agentskills.io)
- `.opencode/tools/behaviorOS.ts` — filename vira tool
- `.opencode/plugins/behaviorOS.ts` — `tool.execute.before` + `session.idle`
- `docs/OPENCODE-INSTRUCTIONS.md`

## Architecture

```
opencode.json ("*": "allow")
  ↓ plugins/behaviorOS.ts:tool.execute.before
  → govern() → block|escalate → pede humano
  → warn|log → auto-approve
  ↓ tools/behaviorOS.ts (action, missionId)
  ↓ agents/* (mode: primary → orchestrator delega para subagents)
  ↓ skills/* (SKILL.md)
```

## Hands-on

```bash
cat opencode.json
ls .opencode/agents/*.md
ls .opencode/skills/*/SKILL.md 2>/dev/null | head
cat .opencode/tools/behaviorOS.ts | head -n 50
cat .opencode/plugins/behaviorOS.ts | head -n 50
opencode --help 2>&1 | head
```

## OpenCode prompt

```
Leia opencode.json, .opencode/agents/orchestrator.md e .opencode/plugins/behaviorOS.ts.
Explique: 1) por que "*": "allow" não é inseguro (governance), 2) como o plugin decide auto-approve vs humano, 3) diferença agent mode primary vs subagent.
```

## Expected result

Explica permissões + plugin gate + modes com arquivo:linha.

## Verification

```bash
grep -q '"\*": "allow"' opencode.json && echo "allow ok"
ls .opencode/agents/*.md | wc -l  # 8
ls .opencode/skills/* -d | wc -l  # 9
```

## Common mistakes

- Criar `.opencode/skills/foo.md` em vez de `skills/foo/SKILL.md` — não carrega.
- Nomear tool `myTool.ts` com camelCase — filename vira tool name, use `behaviorOS.ts` pattern.

## Troubleshooting

Plugin não carrega → `opencode` log `plugin loaded` + `opencode.json:plugin` path existe.

## Challenge

Crie skill `my-skill/SKILL.md` minimal e teste no TUI `/skill my-skill`.

## Completion criteria

Lista 8 agents + 9 skills + tool + plugin e explica auto-approve.

---

# BOS-LESSON-081 — Permissions & Auto-approve Matrix

## Learning objective

Configurar `permission` por agente e entender ordem (última regra vence).

## Prerequisites

BOS-LESSON-080

## BehaviorOS implementation

- `opencode.json:10-25` — global `permission: { "*": "allow", "bash":"allow", ... }`
- `.opencode/agents/*.md` — per-agent permission overrides
- `docs/INTEGRATION-CONTRACTS.md` — coluna Auto-approve

## Hands-on

```bash
cat opencode.json | grep -A20 permission
cat .opencode/agents/qa.md
cat docs/INTEGRATION-CONTRACTS.md | head -n 60
```

## OpenCode prompt

```
Explique a matriz de permissões do BOS: global vs per-agent, ordem de avaliação, e auto-approve matrix (warn|log vs block|escalate).
```

## Completion criteria

Tabela `Ação Governance → Auto-approve? → Quem decide`.
