# BOS-LESSON-070 — Learning Engine: record → detect → auto

> Módulo 07 · STABLE · 1.3.0

## Learning objective

Operar `LearningEngine`: registrar feedback, detectar padrões, auto-aplicar evolução.

## Prerequisites

06 Pipelines

## Concept

Learning = memória do OS. `recordLearning` → `detectPatterns` → `auto-apply wf-evolved-*`. Não é "LLM memory" genérica — é pipeline `learn.json` com evidência e `self-evolution` (`wf-evolution-*`, `wf-LEARN-EXEC`).

## Why it matters

Sem learning, o BOS repete erros. Com, cada mission melhora a próxima.

## BehaviorOS implementation

- `src/core/learning.ts` — `LearningEngine`
- `behavior-os/workflows/learn.json` — pipeline de aprendizado
- `behavior-os/workflows/wf-evolution-*.json` + `wf-LEARN-EXEC.json` — evoluções auto-geradas
- `src/index.ts:BehaviorOS.recordLearning`
- `docs/SELF-EVOLUTION-SPEC.md`

## Hands-on

```bash
cat behavior-os/workflows/learn.json
ls behavior-os/workflows/wf-evolution* 2>/dev/null | head
ls behavior-os/workflows/wf-LEARN* 2>/dev/null | head
grep -r "recordLearning" src/ --include="*.ts" | head
pnpm demo  # gera learning implicitamente via evidence
```

## OpenCode prompt

```
Leia src/core/learning.ts e behavior-os/workflows/learn.json.
Explique o fluxo record→detect→auto e mostre um wf-evolved-* real.
Como o BOS evita auto-evolução não auditada?
```

## Expected result

Fluxo + exemplo `wf-evolved-*` + menção a `evidence` como gate.

## Verification

```bash
ls behavior-os/workflows/wf-evolution* 2>/dev/null && echo "evolution found" || echo "run pnpm demo:autonomous"
cat behavior-os/runtime/demo.json | grep -i learn | head
```

## Common mistakes

- Achar que `recordLearning` é automático sem `learn` workflow — precisa `learn.json` pipeline.

## Troubleshooting

Sem `wf-evolved` → `pnpm demo:autonomous` gera evoluções.

## Challenge

Proponha 1 padrão que `detectPatterns` deveria capturar (ex: `test` stage sempre falha em coverage).

## Completion criteria

Explica 3 fases com arquivo:linha + aponta 1 wf-evolved real.

---

# BOS-LESSON-071 — Self-Evolution

## Learning objective

Distinguir `Self-Evolution` de `Learning` e entender `brainstorm.json` → `evolve.json`.

## Prerequisites

BOS-LESSON-070

## BehaviorOS implementation

- `behavior-os/workflows/brainstorm.json` → `evolve.json`
- `docs/SELF-EVOLUTION-SPEC.md`
- `src/core/self-evolution.ts`

## OpenCode prompt

```
Compare learn.json vs evolve.json vs brainstorm.json.
Qual gera novo workflow e qual registra aprendizado?
```

## Completion criteria

Diferencia 3 workflows com fonte.
