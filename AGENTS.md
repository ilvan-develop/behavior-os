# AGENTS.md — behaviorOS

> Este arquivo é a regra persistente do projeto. Lido por OpenCode, Claude Code e outros agentes compatíveis.

## Produto
**behaviorOS** (marca) / `behavior-os` (identificador técnico: pasta, workflows, runtime) / `behavior-os` (npm: `behavior-os`).
Comando: `npx behavior-os init` (alias `npx behaviorOS init`)

## Princípio Arquitetural
`Mission → Workflow Engine → Agents → Skills → Governance → Evidence`
`OpenCode` é superfície de execução. `Graphify` é camada de conhecimento (não autoridade). `LangGraph` é runtime durável opcional.

## Regra de Ouro
**Configuração não é integração.** Integração só é funcional com **evidência observável**.
- Graphify funcional = `graphify-out/graph.json` existe (gerado por `/graphify .` ou `graphify . --update`)
- LangGraph funcional = `StateGraph` com nós/edges/checkpoints compilado e testado e2e
- Qualquer workflow funcional = `behavior-os/runtime/*.json` com `status: COMPLETED`

## Estrutura Nativa OpenCode (não inventar)
- Agentes: `.opencode/agents/*.md` (mode: primary|subagent|all)
- Skills: `.opencode/skills/*/SKILL.md`
- Tools: `.opencode/tools/*.ts` (filename vira tool)
- Plugins: `.opencode/plugins/*.ts` (auto-load)
- MCP: declarado em `opencode.json` → `mcp: { graphify: { type:"local", command:["python","-m","graphify.serve","graphify-out/graph.json"] } }`
- Comandos: `.opencode/commands/*.md` ou `command: {}` em `opencode.json`
- Permissões: `permission` em `opencode.json` e por agente; ordem importa (última regra vence)

## Workflow Declarativo
Workflows vivem em `behavior-os/workflows/*.json` com `stages` e `handoffs`. Não colocar lógica de orquestração em prompt único.

```json
{ "id":"development", "stages":["discover","plan","architect","implement","test","security","review","evidence"], "handoffs": { "discover":"planner" } }
```

## Gates Obrigatórios
`pnpm install → pnpm typecheck → pnpm test → pnpm demo → pnpm doctor`
O bootstrap testa o sistema, não só cria arquivos. Falha em qualquer gate bloqueia entrega.

## Soberania do Host
`npx behavior-os init` instala em qualquer `my-saas/` sem transformar o SaaS no behaviorOS. O host mantém `src/`, `package.json`, `prisma/` etc intactos.

## MCP (overlay mínimo, sem literais)
- Context7 local default em `opencode.json`: `mcp.context7` com `type: "local"`, `command: ["npx", "-y", "@upstash/context7-mcp", "--api-key", "{env:CONTEXT7_API_KEY}"]`, `enabled: true`. Chave via env `CONTEXT7_API_KEY` (ver `.env.example` com `YOUR_API_KEY`), nunca token literal.
- Remoto só como fallback: `type: "remote"` com `Bearer {env:CONTEXT7_API_KEY}` (placeholder `{env:}`, sem literal).
- Graphify local mantido: `command: ["python", "-m", "graphify.serve", "graphify-out/graph.json"]`.
- Windows: se `npx` falhar como bin direto, prefixar `command` com `cmd /c`.
- Refs:
  - https://context7.com/docs/resources/all-clients#opencode
  - https://graphify.com/docs
  - https://github.com/Graphify-Labs/graphify
