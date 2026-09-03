# School and Community — BehaviorOS

> Índice raiz. Entrada para humanos e agentes.

## O que é

- **BehaviorOS School** (`school-bos/`): *Learn how to build and operate autonomous AI teams.* — 16 módulos (00→15), 30 lições, 3 tracks (Foundations/Builder/Architect), cada com hands-on + OpenCode prompt.
- **BehaviorOS Community** (`social/`): *Learn. Build. Share. Contribute.* — LinkedIn, WhatsApp, workshops, slides, building in public.

**Don't just learn BehaviorOS. Learn to think in BehaviorOS.** — `Mission → Behavior → Governance → Pipeline → Evidence → Quality → Learning`

## Como começar

1. **Humano novo:** `school-bos/README.md` → `school-bos/CURRICULUM.md` → `school-bos/LEARNING-PATH.md` → `school-bos/00-orientation/README.md`
2. **Dev:** Track B (`LEARNING-PATH.md`) → `02-installation` → `03-first-mission` (`pnpm demo`)
3. **Architect:** Track C → `12-autonomous-teams` + `13-production` + `docs/adr/`
4. **Community manager:** `social/README.md` → `social/CONTENT-STRATEGY.md` → `social/EDITORIAL-CALENDAR.md` → `social/linkedin/weekly/WEEK-01.md`

## Índices

- `school-bos/INDEX.md` — índice School (módulos + fontes técnicas)
- `social/INDEX.md` — índice Community (LinkedIn, WhatsApp, images, slides)
- `school-bos/GLOSSARY.md` — 25 termos
- `school-bos/FAQ.md` + `school-bos/TROUBLESHOOTING.md`

## Trilhas (resumo)

| Track | Público | Módulos | Tempo |
|-------|---------|---------|-------|
| Foundations | Usuário | 00,01,02,03,04i,06i,14 | 4h |
| Builder | Dev | Foundations + 04→11,13,15 | 12h |
| Architect | Avançado | Builder + 12 + ADRs + ARCHITECTURE.md | 20h |

## Social & Content

- `social/linkedin/weekly/WEEK-01.md` — 5 posts prontos (Seg→Sex)
- `social/whatsapp/weekly/WEEK-01.md` — digest WhatsApp
- `social/images/prompts/` — 13 prompts (hero, architecture, governance, knowledge graph, etc.)
- `social/slides/training/` — 10 decks Markdown (Intro → Capstone)
- `social/CONTENT-WORKFLOW.md` — `SOURCE→RESEARCH→VERIFY→LESSON→SOCIAL→IMAGE→SLIDES→WHATSAPP→COMMUNITY→FEEDBACK→LEARNING→IMPROVE`

## Geração automatizada

Templates permitem ao OpenCode gerar `weekly LinkedIn/WhatsApp, release, tutorial, deep dive, carousel, slide deck, image prompt` derivado do repo real. Ver `social/linkedin/README.md` prompt + `social/CONTENT-QUALITY-GATES.md` (10 gates).

## Versionamento

BehaviorOS `1.3.0` · Docs `v1` · Verificado `2026-09-03` · Status `STABLE` por lição. `PLANNED`/`EXPERIMENTAL` label quando não implementado.

## Regra de Ouro

> **Configuração não é integração.** Só `behavior-os/runtime/*.json` `COMPLETED` + `graphify-out/graph.json` + `StateGraph` compilado + `pnpm doctor PASS` contam. — `AGENTS.md`

## Próximo passo

Abra `school-bos/00-orientation/README.md` e cole o OpenCode prompt no TUI.

---

Criado por **Ilvan Joaquim** 🇦🇴 Angola · Luanda — [github.com/ilvan-develop](https://github.com/ilvan-develop) · [behavior-os](https://github.com/ilvan-develop/behavior-os) · [linkedin/in/ilvan-joaquim-0b0989195](https://www.linkedin.com/in/ilvan-joaquim-0b0989195/) · [npm: behavior-os](https://www.npmjs.com/package/behavior-os)
