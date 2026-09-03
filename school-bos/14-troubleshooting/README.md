# BOS-LESSON-140 — Troubleshooting: Doctor Gates

> Módulo 14 · STABLE · 1.3.0

## Learning objective

Diagnosticar qualquer falha via `pnpm doctor` e corrigir sem adivinhar.

## Prerequisites

13 Production

## Concept

`doctor` = Regra de Ouro automatizada. 20+ gates: AGENTS, opencode.json, agents 8, skills 8, behavior-os config, runtime evidence, graphify 1202, langgraph 8, workflows 18, control-plane Semver, evidence.version, mcp 45 valid, federated provenance, traces W3C. `overall: PASS` ou `FAIL (n gates)`.

## Why it matters

Sem doctor, você debuga no escuro. Com, cada FAIL tem hint.

## BehaviorOS implementation

- `src/cli/doctor.ts:1-265` — todos os gates + hints
- `TROUBLESHOOTING.md` (school-bos) — matrix
- `pnpm doctor` (package.json:56)

## Hands-on

```bash
pnpm doctor
# Force FAIL example:
# mv graphify-out/graph.json /tmp/ && pnpm doctor 2>&1 | grep graphify; mv /tmp/graph.json graphify-out/graph.json
pnpm typecheck && pnpm test 2>&1 | tail -n 20
```

## OpenCode prompt

```
Rode pnpm doctor e para cada FAIL explique causa + fix (arquivo:linha em src/cli/doctor.ts).
Se PASS, mostre o que cada gate provou (ex: mcp 45 tools valid).
```

## Expected result

Relatório `Gate → Status → Prova` com hints.

## Verification

```bash
pnpm doctor 2>&1 | grep -E "PASS|FAIL|overall"
pnpm test 2>&1 | grep -E "55/55|passed|failed"
```

## Common mistakes

- Ignorar `CONFIGURED` vs `functional` para graphify — `CONFIGURED` não é FAIL, é aviso para rodar `graphify extract`.

## Troubleshooting

Ver `TROUBLESHOOTING.md` matrix.

## Challenge

Quebre propositalmente 1 gate (ex: remova `.opencode/agents/qa.md`) e recupere.

## Completion criteria

Roda `doctor` e explica 5 gates com fix.
