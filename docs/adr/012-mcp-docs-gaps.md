# ADR 012 — MCP docs gaps (proposta, sem mutar host)

**Status:** Accepted | **Versão:** behaviorOS v2.1.0 | **Data:** 2026-09-03 | **Missão:** `fix-mcp-docs` (stage `implement` iter2)
**Regra:** Soberania do host preservada — `src/`, `package.json`, `prisma/`, `.env`, `node_modules` intocáveis pelo implementer. Propostas abaixo são para `reviewer`/`orchestrator` decidir.

---

## Contexto

Contrato architect P0+M4+P1 para `fix-mcp-docs` previa possibilidade de M4 exigir mudanças em `src/core/governance.ts` ou `src/core/evidence-ledger.ts` (ex: espelhar `Gateway blocked protected path .env` do plugin em policy-as-code, ou compor `evidence.mcp` com bloqueio de `.env`). O implementer NÃO editou `src/` (allowlist overlay permite apenas `.opencode/plugins/*`, `.opencode/skills/*`, `docs/`, `school-bos/`, `behavior-os/runtime/*` leitura).

## Gaps registrados (não-editados, para qa/security/reviewer)

### GAP-1 — `protected-paths` policy não espelha mensagem do plugin
- **Local proposto:** `src/domain/policies.ts` (`protectedPathsPolicy`) + `src/core/governance.ts` (`evaluateAll` ordem fixa).
- **Proposta:** incluir `read:.env` (exceto `.env.example`) como `block` com reason `Gateway blocked protected path .env`, alinhado a `.opencode/plugins/behaviorOS.ts:tool.execute.before`.
- **Por que não feito:** `src/` é host soberano; implementer só endureceu o plugin (overlay permitido).
- **Aceite sugerido:** `qa`/`security` validar se policy atual já bloqueia `.env` em `inputs` de missão; se não cobrir `tool.read`, `reviewer` aprova patch em missão separada.

### GAP-2 — `evidence-ledger` não registra bloqueios de plugin
- **Local proposto:** `src/core/evidence-ledger.ts` (compor `evidence.mcp.invocations[]` com `status:blocked`, `blockedBy:protected-paths`).
- **Proposta:** quando plugin lança `Gateway blocked protected path .env`, o Gateway/Marketplace registrar `GatewayInvocation{status:blocked}` em `behavior-os/runtime/mcp.json:invocations`.
- **Por que não feito:** mesmo motivo — `src/` intocável neste stage.
- **Aceite sugerido:** `reviewer` decide se evidência de bloqueio é P1 (docs atuais bastam) ou vira missão `fix-evidence-blocked`.

## Entregas deste stage (overlay, feitas)

- M1: `.opencode/plugins/behaviorOS.ts` — `read .env` (não-`.env.example`) → `throw new Error("Gateway blocked protected path .env")` (antes: fall-through permitia leitura).
- M2: sem rebuild — `graphify-out/graph.json` existe, `fresh` (~0.3h, `mtime` 13:26 UTC). **MISMATCH detectado na validação final (13:47 UTC):** `sha256(graph.json)[0:16]=b7b245606c19a664` ≠ `federated.json:sources[0].hash=487c1b1b22e50b6e` (`federated.json` regenerado às 13:46 UTC por processo paralelo, `valid:true` mas hash divergente). Runtime NÃO mutado (sem stub). **Para `qa`: rodar `python -m graphify update .` e confirmar `sources[0].hash == b7b245606c19a664`.**
- P1 docs: `.opencode/skills/graphify-query/SKILL.md` (path/explain/--dfs/hook/`npx skills add`/agentskills.io/`graphifyy`/leiden) + `school-bos/11-mcp/README.md` (tabela serve local vs codebase-memory + links graphify.net).
- `AGENTS.md`: sem alteração (seção MCP já precisa e correta; alteração evitada para não quebrar `permission last-wins`).

## Referências

- `.opencode/plugins/behaviorOS.ts:9-16` (pós-fix)
- `behavior-os/runtime/mcp.json` (`tools 45`, `servers 2`, `valid:true`)
- `graphify-out/graph.json` (`sha256[0:16]=b7b245606c19a664`) + `graphify-out/federated.json` (`valid:true`)
- ADR 004 (Policy-as-code), ADR 007 (MCP Marketplace), AGENTS.md (Soberania do Host + Writable Allowlist)
