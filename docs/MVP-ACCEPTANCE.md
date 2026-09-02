# MVP Acceptance — v1.1.0

## Critérios (todos must PASS)

- [ ] `pnpm install` — PASS
- [ ] `pnpm typecheck` — PASS (0 errors)
- [ ] `pnpm test` — 3/3 suítes (kernel, mission, evidence)
- [ ] `pnpm demo` — COMPLETED, `behaviorOS/runtime/demo.json` com `status: COMPLETED`
- [ ] `pnpm doctor` — PASS (AGENTS.md, opencode.json, 8 agents, 7 skills, evidence, graphify CONFIGURED)
- [ ] `graphify-out/graph.json` — ausente é OK (só após /graphify .), mas MCP declarado
- [ ] Todos os ~70 arquivos com conteúdo único, não repetido, e pastas presentes

## Verificação

```bash
pnpm install && pnpm typecheck && pnpm test && pnpm demo && pnpm doctor
cat behaviorOS/runtime/demo.json | grep COMPLETED
opencode debug config | grep graphify
```

## Não-aceitação

Arquivos vazios, textos repetidos, pastas faltando, ou LangGraph marcado funcional sem StateGraph → FAIL.
