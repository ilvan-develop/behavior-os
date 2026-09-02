# Security — behaviorOS

- Governance em `src/domain/policies.ts` e `governance/policies/default.json` bloqueia `protected-paths`.
- Plugin `.opencode/plugins/behaviorOS.ts` pode interceptar `tool.execute.before` para `.env` (exemplo).
- Não armazenar secrets em `opencode.json`; usar `{env:VAR}` interpolation em headers MCP.
- Audit via `pnpm audit` (self-test --audit) e verificação de permissões por agente.
