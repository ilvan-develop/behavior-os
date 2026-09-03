# CONTRIBUTING — BehaviorOS School

## Como contribuir com a School

1. Leia `CURRICULUM.md` e `GLOSSARY.md`.
2. Escolha uma lição ou crie nova seguindo o **padrão de lição** (ver CURRICULUM).
3. Baseie-se no **repositório real** — linke `arquivo:linha`.
4. Marque status: `STABLE` (verificado), `EXPERIMENTAL`, `PLANNED`, `DEPRECATED`.
5. Inclua **OpenCode prompt** testável.
6. Rode `pnpm typecheck && pnpm test && pnpm doctor` antes do PR.

## Padrão de lição (resumo)

```
# Título (BOS-LESSON-XXX)
## Learning objective | Prerequisites | Concept | Why it matters
## BehaviorOS implementation (arquivo:linha) | Architecture | Hands-on
## OpenCode prompt | Expected result | Verification | Common mistakes
## Troubleshooting | Challenge | Completion criteria
```

## Regras

- Não invente capacidades. Se `PLANNED`, label explícito.
- Todo conteúdo traçável: `BOS-LESSON-XXX → BOS-LINKEDIN-XXX → BOS-SLIDE-XXX → BOS-WA-XXX`.
- Visual identity coerente; nunca screenshot falso.
- Versão + data de verificação obrigatórios no topo.

## Revisão

Todo PR passa `social/CONTENT-QUALITY-GATES.md` checklist (accuracy, evidence, audience, CTA, traceability, terminology).
