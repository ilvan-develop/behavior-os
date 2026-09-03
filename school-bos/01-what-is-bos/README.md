# BOS-LESSON-010 — What is BehaviorOS?

> Módulo 01 · STABLE · `1.3.0` · 2026-09-03

## Learning objective

Definir BehaviorOS em 1 frase e contrastar com/sem BOS (tabela README).

## Prerequisites

00 Orientation

## Concept

BehaviorOS = framework de **governança comportamental** que dá a teams de agentes: regras DNA-driven, pipelines determinísticos, orquestração autônoma, audit trail e learning. Não é "mais um orchestrator" — é o OS que define *como* agentes operam.

## Why it matters

Agentes sem governança são imprevisíveis; sem evidence, não auditáveis; sem learning, não evoluem.

## BehaviorOS implementation

- `README.md:14` — definição canônica
- `README.md:29-36` — tabela Sem/Com BOS
- `package.json:2-4` — `behavior-os` 1.3.0, exports `.` + `./domain` + `./workflow`
- `src/index.ts` — entry do OS

## Hands-on

```bash
cat README.md | head -n 50
cat package.json | grep -A2 '"name"'
grep -r "BehaviorOS" src/index.ts | head
```

## OpenCode prompt

```
Leia README.md seções "Por que behaviorOS?" e "Arquitetura 9 Layers".
Explique o que é BehaviorOS vs o que não é, usando a tabela Sem/Com e o diagrama de 9 layers.
Cite arquivo:linha.
```

## Expected result

Definição + tabela + diagrama explicados com fontes.

## Verification

`grep -q "Operating System for Autonomous AI Teams" README.md && echo ok`

## Completion criteria

Recita definição + 3 diferenças Sem/Com + nomeia 3 layers.

---

# BOS-LESSON-011 — The 9 Layers OS

## Learning objective

Mapear as 9 camadas (Mission, Learning, Quality, Pipeline, Governance, Behavioral, DNA + OpenCode/Graphify/LangGraph).

## Prerequisites

BOS-LESSON-010

## BehaviorOS implementation

- `README.md:64-92` — diagrama 9 layers
- `src/domain/types.ts:WorkflowStage`, `Evidence` (Quality, Governance, Traces)
- `behavior-os/config/governance.json` + `packages/governance/policy.rego`

## Hands-on

Desenhe as 9 camadas e para cada: 1 arquivo, 1 prova observável (ex: `behavior-os/runtime/demo.json` para Evidence).

## OpenCode prompt

```
Explique as 9 layers do BehaviorOS (README diagrama).
Para cada layer, diga 1 arquivo e 1 evidência observável (Regra de Ouro).
```

## Completion criteria

Lista 9 layers com arquivo + evidência.
