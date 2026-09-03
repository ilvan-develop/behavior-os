# LinkedIn System — BehaviorOS

> Source: `CONTENT-STRATEGY.md` · Pillars: 15 · Version: 1.3.0

## Categorias

`weekly/`, `technical/`, `educational/`, `thought-leadership/`, `architecture/`, `tutorials/`, `launches/`, `community/`, `building-in-public/`

## Template (todo post)

```
> BOS-LINKEDIN-XXX · Source: BOS-LESSON-XXX · Pillars: [X,Y] · Status: STABLE · Verified: 2026-09-03
> Evidence: arquivo:linha + evidence

# Title
Hook (1ª linha — dor ou curiosidade)
Body (4-7 parágrafos, 1 conceito + 1 prova + 1 exemplo)
CTA (1 ação: npx init, school-bos/XX, pnpm demo, comunidade)
Hashtags (3-5): #BehaviorOS #AIAgents #OpenCode #Graphify #LangGraph
Visual: descrição + image prompt (social/images/prompts/)
Carousel?: 3-5 slides outline
WhatsApp adaptation: link para social/whatsapp/weekly/WEEK-XX.md
```

## Tipos

- **technical post** — deep dive com código + arquivo:linha
- **educational** — conceito simples + diagrama
- **architecture** — 9 layers, StateGraph, OTel
- **tutorial** — copy/paste + verification
- **launch** — release + evidence (CHANGELOG, demo COMPLETED)
- **community** — convite + valor educacional
- **building-in-public** — OS-100, evidence, changelog

Ver `templates/` implícito em cada pasta + `weekly/WEEK-01.md` para pacote completo.

## Weekly engine

Ver `../EDITORIAL-CALENDAR.md` — Seg: conceito, Ter: technical, Qua: tutorial, Qui: arquitetura, Sex: community.

Cada weekly package contém: title, hook, body, CTA, hashtags, visual, image prompt, carousel, WhatsApp adaptation, source lesson, verification status.

## Geração automatizada

Prompt para OpenCode:
```
Gere BOS-LINKEDIN-XXX semanal derivado de BOS-LESSON-XXX.
Use repo real (README, dnas, src, evidence). Não invente features.
Inclua: hook, body, CTA, hashtags, visual, image prompt, carousel, WhatsApp adaptation, source, status.
Valide com CONTENT-QUALITY-GATES.md.
```
