# Governance — behaviorOS

Governance é policy-as-code. Toda missão passa por `src/domain/policies.ts` antes de mutar.

## Policies

- `default` — id, title, workflowId obrigatórios
- `protected-paths` — bloqueia alvos em `prisma/migrations`, `.env`, `node_modules`

Config em `governance/policies/default.json` espelha `behaviorOS/config/governance.json` para auditabilidade.
