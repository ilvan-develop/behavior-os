# ADR 010 — DNA Patterns P2 v2.0 (12 patterns)

## Contexto
P1 tinha 1 pattern `enterprise-governance` em `dnas/`. P2 v2.0 exige 12 DNA patterns reutilizáveis cobrindo modelos de equipe (Brooks, plataforma, swarm) e níveis de governança (startup ? high-assurance) sem alterar Kernel. Regra de Ouro: configuração ? integração — DNA só é funcional quando validado e evidência gerada.

## Decisão
Criar `dnas/*.yaml` com contrato fixo `kind: dna | version: semver | id | description | personas[] | governance[] | quality[] | workflows[]`:

- **Interfaces:** cada DNA declara `personas` com `role, authority (architect|implementer|researcher|qa|security|reviewer|orchestrator), boundaries[], skills[], permission{read,edit,bash}` mapeando para `.opencode/agents/*.md` e `.opencode/skills/*/SKILL.md`. `workflows[]` declara `id, stages[], handoffs{}, parallelGroups?` compatível com `behavior-os/workflows/*.json` e `src/workflow/engine.ts`.
- **Fronteiras:** `src/domain` define `Mission, Workflow, Evidence`; `src/core` (`mission-engine, governance, evidence-ledger`) consome DNA como dados, não importa `dnas/` diretamente; `adapters` (opencode, graphify, langgraph) permanecem desacoplados. Kernel não importa adapters (ADR 001).
- **Governance:** `governance[]` com `id, level (critical|high|medium|low|info), action (block|escalate|warn|log|pass), conditions{ risk, path, behaviorLevel, stage }` avaliado por `src/core/governance.ts` `evaluateAll` (AND fail-closed). `quality[]` com `type (test_coverage|lint|typecheck|audit|evaluator|...) + threshold` gateado em `test`/`security` stages.
- **12 patterns:**
  1. `enterprise-governance` (base, compliance)
  2. `surgical-team` (Brooks, chief architect, narrow slices)
  3. `startup-velocity` (parallel, low gates 60%)
  4. `platform-team` (SRE, infra, multi-tenant)
  5. `autonomous-swarm` (Level 7, LangGraph durable, evaluator-optimizer)
  6. `research-lab` (Graphify-first, docs/graph gates)
  7. `incident-response` (SEV1, parallel qa+security, rollback)
  8. `open-source` (maintainer, contributor ask/ask, community)
  9. `regulated-fintech` (SOC2/PCI, audit 100, protected-paths hardened)
  10. `product-discovery` (lean, prototype gate, short cycle)
  11. `high-assurance` (aerospace, 95% coverage, dual approval)
  12. `scaled-enterprise` (SAFe, behaviorLevel 6, parallelGroups, program gate)

Versão: P2 patterns `2.0.0`; legado `enterprise-governance` permanece `1.0.0` para compatibilidade `npx behavior-os init --preset enterprise-governance`.

## Consequência
- `npx behavior-os init --preset <id>` pode copiar qualquer pattern (scaffolder preserva `src/` host sovereignty).
- `doctor` valida `dnas/*.yaml` parse + `personas/governance/quality/workflows` não vazios; falha bloqueia entrega.
- Nenhuma lógica de orquestração em prompt único — workflow permanece declarativo em `behavior-os/workflows/*.json` com `handoffs`; DNA apenas seleciona personas/workflow.
- Evolução futura via `packages/dna/evolution.ts` pode propor `wf-evolved-*` efêmero quando `evaluator.coverage <95`.

## Evidência
- `dnas/*.yaml` 12 arquivos existem, `yaml.parse` PASS 12/12, cada com =3 personas, =3 governance, =3 quality, =1 workflow.
- `pnpm typecheck` e `pnpm test` devem continuar PASS (DNA é dado, não código).

## Alternativas consideradas
- 1 arquivo monolito `dnas/catalog.yaml` — rejeitado (perde granularidade preset, dificulta `init --preset` e `external_directory` allow).
- Gerar via `packages/dna/registry.ts` — adiado para v2.1 (P2 foca arquivos estáticos observáveis).
