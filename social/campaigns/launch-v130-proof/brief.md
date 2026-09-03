# Brief — launch-v130-proof (BehaviorOS v1.3.0 com prova)

> Status: STABLE · Verified: 2026-09-03 · Source: `docs/OS-100-REPORT.md` v1.3.0 + `behavior-os/runtime/demo.json` COMPLETED

## Objetivo
Provar (não prometer) que behaviorOS v1.3.0 entrega governança + pipeline + evidence. Trocar badges antigas (55/55, 1202 nodes) por números verificáveis (401/401, 1858 nodes).

## Audiência
CTO, Dev Backend, AI Researcher, Estudante, OSS contributor — ver `social/linkedin/community/BOS-LINKEDIN-061-invites-perfil.md`.

## Pilar / Source
Pillars [1,14,15] · Source lesson: `school-bos/` orientation + `docs/adr/002-evidence-first.md` + `docs/adr/009-knowledge-federation.md`.

## Prova (Regra de Ouro)
- `pnpm test` → 401/401 (25 files)
- `pnpm demo` → `behavior-os/runtime/demo.json` COMPLETED, `evaluator.approved:true`, `coverage:100%`
- `graphify-out/graph.json` → 1858 nodes, fresh (`python -m graphify extract . --code-only`)
- `graphify-out/federated.json` → 1858 nodes, 2775 links, valid:true (LEARN-09)
- `behavior-os/runtime/mcp.json` → 45 tools, 2 servers, valid:true
- `behavior-os/runtime/traces/demo.json` → W3C traceId 32 hex, 9 spans
- `pnpm doctor` → PASS · `pnpm build` → PASS (tsc)

## Mensagem única
**Configuração ≠ integração. Integração = evidence observável.**

## Não fazer
- Não citar 55/55 ou 207/1202 nodes (números antigos).
- Não representar `PLANNED` como `STABLE` (ver `CONTENT-QUALITY-GATES.md`).
- Sem fake screenshots.
