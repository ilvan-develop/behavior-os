# CONTENT-QUALITY-GATES — BehaviorOS

> Checklist obrigatório para todo artefato (lesson, post, slide, prompt, WhatsApp).

## Gates (10)

- [ ] **1. Technical accuracy** — afirmações conferem com `arquivo:linha` + `pnpm doctor`?
- [ ] **2. Repository evidence** — `behavior-os/runtime/*.json COMPLETED` ou `graph.json` ou `StateGraph` compilado citado?
- [ ] **3. No fabricated capabilities** — `PLANNED`/`EXPERIMENTAL` label quando não STABLE?
- [ ] **4. Clear audience** — Foundations / Builder / Architect + dor endereçada?
- [ ] **5. Clear objective** — o leitor faz o quê depois (CTA)?
- [ ] **6. Useful CTA** — `npx behavior-os init`, `school-bos/XX`, `pnpm demo`, ou comunidade (não genérico)?
- [ ] **7. Consistent terminology** — `GLOSSARY.md` termos (Mission, DNA, Governance, Evidence)?
- [ ] **8. Consistent positioning** — `BRAND-DNA.md` (OS, 9 layers, Regra de Ouro)?
- [ ] **9. Appropriate depth** — técnico certo para audiência (não over/under)?
- [ ] **10. Source traceability** — `BOS-LESSON-XXX` + `source file:line` + `version 1.3.0` + `status`?

## Falha = bloqueia publicação

Como `GoveranceEngine block` — se 1 gate falha, corrige antes de publicar.

## Verificação

```bash
# Antes de publicar, rode:
pnpm doctor 2>&1 | grep "overall: PASS" || echo "fix repo first"
grep -r "BOS-LESSON" social/linkedin/ --include="*.md" | head  # traceability
grep -r "PLANNED\|EXPERIMENTAL" social/ --include="*.md" | head  # label check
```

## Template header (todo arquivo deve ter)

```
> Source: BOS-LESSON-XXX · Pillars: [X,Y] · Version: 1.3.0 · Status: STABLE · Verified: 2026-09-03
> Evidence: arquivo:linha + behavior-os/runtime/demo.json COMPLETED (ou graph.json, etc.)
```
