# BOS-LESSON-150 — Capstone: Build an Autonomous AI Development Team

> Módulo 15 · STABLE · 1.3.0 · **Projeto final integrador**

## Learning objective

Construir do zero um time autônomo que orquestra `Mission → Evidence` com DNA custom, governance, pipeline paralelo, Graphify e LangGraph — e operar em produção com tracing.

## Prerequisites

00→14 completos (ou Track B/C).

## Concept

Capstone integra tudo: `DNA → Personas → Governance → Pipeline → Handoffs → Quality Gates → Evidence → Learning → OpenCode → Graphify → LangGraph → Production`. É o primeiro caso de uso real do BOS como **content mission** (Research → Knowledge Graph → Curriculum → Lesson → LinkedIn/WhatsApp/Slides → Community → Feedback → Learning → Improve).

## Why it matters

Prova que você *pensa em BehaviorOS*, não apenas instala.

## BehaviorOS implementation

Todos os arquivos anteriores +:

- `dnas/enterprise-governance.yaml` (template)
- `behavior-os/workflows/development.json` + `parallel.json` + `autonomous.json`
- `src/workflow/langgraph-graph.ts` (8 nodes + parallel)
- `graphify-out/graph.json` + `federated.json`
- `behavior-os/state/control-plane.json` + `behavior-os/runtime/traces/*.json`

## Architecture (entrega)

```
my-saas-capstone/
├── dnas/capstone-team.yaml          # 3 personas (architect, backend, qa) + 3 governance + 2 quality
├── behavior-os/workflows/capstone.json  # 6 stages + handoffs + parallelGroups [test,security]
├── behavior-os/missions/capstone-01.json
├── behavior-os/runtime/capstone-01.json # COMPLETED, overall 100, traces, mcp, federation
├── behavior-os/runtime/traces/capstone-01.json # W3C valid
└── graphify-out/graph.json          # updated, federated valid
```

## Hands-on (passo a passo)

**1. DNA**
```bash
cat dnas/enterprise-governance.yaml > dnas/capstone-team.yaml
# Edite: id: capstone-team, adicione persona researcher se precisar
python -c "import yaml; yaml.safe_load(open('dnas/capstone-team.yaml')); print('dna valid')"
```

**2. Pipeline**
```bash
cat behavior-os/workflows/development.json > behavior-os/workflows/capstone.json
# Edite: id: capstone, stages: [discover, plan, implement, test, security, evidence], handoffs + parallelGroups [["test","security"]]
cat behavior-os/workflows/capstone.json | python -m json.tool | head
```

**3. Mission via SDK ou demo**
```bash
# Opção SDK:
# import { BehaviorOS } from 'behavior-os'
# const bos = new BehaviorOS({ dnaPath: './dnas/capstone-team.yaml' })
# const m = await bos.createMission({ title: 'Capstone: payment v2', workflowId: 'capstone' })
# await bos.startMission(m.id)
# Opção demo adaptado:
pnpm demo
# Verifique que capstone workflow é válido:
pnpm typecheck && pnpm test
```

**4. Graphify**
```bash
python -m graphify extract . --code-only 2>&1 | head
cat graphify-out/graph.json | python -c "import json; print(len(json.load(open('graphify-out/graph.json'))['nodes']))"
```

**5. LangGraph paralelo**
```bash
pnpm demo:parallel
cat behavior-os/runtime/demo.json | python -c "import json; d=json.load(open('behavior-os/runtime/demo.json')); print(d['langgraph'])"
```

**6. Production**
```bash
cat behavior-os/state/control-plane.json | grep version
cat behavior-os/runtime/traces/demo.json | python -c "import json; d=json.load(open('behavior-os/runtime/traces/demo.json')); print(d['traceId'], len(d['spans']))"
pnpm doctor 2>&1 | tail -n 20
```

## OpenCode prompt (capstone)

> Paste this prompt into OpenCode

```
Você é o orchestrator do capstone. Execute:

1. Leia dnas/capstone-team.yaml (ou enterprise-governance se não existir) e explique personas/governance/quality.
2. Leia behavior-os/workflows/capstone.json (ou development) e explique stages/handoffs/parallelGroups.
3. Rode pnpm demo (ou startMission via SDK) e mostre behavior-os/runtime/demo.json (status, stages, evaluator, langgraph, traces, mcp, federation).
4. Verifique Graphify (graphify-out/graph.json nodes) e LangGraph (src/workflow/langgraph-graph.ts 8 nodes).
5. Rode pnpm doctor e reporte PASS/FAIL por gate.
6. Se algo falhar, diagnostique com src/cli/doctor.ts hints.
7. Gere um resumo: o que foi provado (Regra de Ouro) e o que falta.

Não invente capacidades; marque PLANNED se não existir.
```

## Expected result

- `dnas/capstone-team.yaml` válido
- `behavior-os/workflows/capstone.json` válido
- `behavior-os/runtime/capstone-01.json` ou `demo.json` `COMPLETED` + `overall 100` ou próximo
- `graphify-out/graph.json` 1200+ nodes, `federated.json valid`
- `langgraph` compiled 8 nodes
- `traces` W3C valid, `mcp` 45 tools valid, `control-plane` Semver
- `pnpm doctor overall: PASS`

## Verification

```bash
test -f dnas/capstone-team.yaml && echo "dna ok"
test -f behavior-os/workflows/capstone.json && echo "workflow ok"
cat behavior-os/runtime/demo.json | grep COMPLETED
cat behavior-os/runtime/traces/demo.json | grep traceId
cat graphify-out/federated.json | grep '"valid": true'
pnpm doctor 2>&1 | grep "overall: PASS"
pnpm typecheck && pnpm test 2>&1 | grep -E "passed|failed"
```

## Common mistakes

- `workflowId` em mission ≠ `id` em workflow JSON → mission não encontra pipeline.
- DNA sem `version` Semver → `doctor control-plane version` FAIL.

## Troubleshooting

Ver `14-troubleshooting/README.md` + `TROUBLESHOOTING.md`.

## Challenge (pós-capstone)

Transforme o capstone em **content mission**: `curriculum → lesson → LinkedIn (social/linkedin/technical/) → WhatsApp → slides (social/slides/training/)` e feche o loop `LEARN→BUILD→SHARE→DISCUSS→CONTRIBUTE→TEACH→IMPROVE` (ver `social/CONTENT-WORKFLOW.md`).

## Completion criteria

Entrega todos os artefatos acima + `doctor PASS` + consegue explicar o fluxo `Mission→Evidence` em 1 minuto.

## Entregável

PR ou pasta `capstone/` com DNA + workflow + evidência + relatório `doctor` + reflexão `O que o BOS governa vs o que o agente decide`.
