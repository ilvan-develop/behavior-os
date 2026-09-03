# CONTENT-STRATEGY — BehaviorOS

## Objetivo

Transformar o repositório em **ecossistema de conhecimento + produto + comunidade**. Métrica: `LEARN→BUILD→SHARE→DISCUSS→CONTRIBUTE→TEACH→IMPROVE` fechado.

## Audiências

| Audiência | Dor | Conteúdo | CTA |
|-----------|-----|----------|-----|
| Dev solo | agentes imprevisíveis | Tutorials, 1st mission | `npx behavior-os init` |
| Team lead | governance manual | Architecture, Governance deep dives | School Track B |
| Architect | durable execution, audit | LangGraph, OTel, Control Plane | School Track C + ADRs |
| Community | aprender e contribuir | Workshops, building in public | WhatsApp + GitHub |

## Funil

```
Awareness (LinkedIn thought-leadership)
  → Education (School lessons)
  → Activation (npx init + demo)
  → Retention (weekly content + WhatsApp)
  → Advocacy (capstone + share)
```

## Cadência

Semanal (ver `EDITORIAL-CALENDAR.md`):

- **Segunda** — Conceito/Educação
- **Terça** — Technical deep dive
- **Quarta** — Tutorial prático
- **Quinta** — Arquitetura / AI agents
- **Sexta** — Community / Building in public

Cada pacote semanal: `title, hook, body, CTA, hashtags, visual, image prompt, carousel, WhatsApp adaptation, source lesson, verification status`.

## Canais

- **LinkedIn** (primário): técnico + thought-leadership + launches.
- **WhatsApp** (comunidade): onboarding, weekly digest, events, announcements (curto, conversacional).
- **Slides** (workshops): training, `social/slides/training/` Markdown → PPT/Google Slides.
- **Images**: `social/images/prompts/` — hero, architecture, agent viz, knowledge graph, workflow.

## Rastreabilidade

```
BehaviorOS feature (arquivo:linha, evidence)
  ↓ BOS-LESSON-XXX
  ↓ BOS-LINKEDIN-XXX (social/linkedin/*)
  ↓ BOS-WA-XXX (social/whatsapp/*)
  ↓ BOS-SLIDE-XXX (social/slides/*)
  ↓ Community discussion
```

IDs estáveis permitem `graphify` navegar `Technical docs ↔ School ↔ Social ↔ Slides`.

## Geração automatizada (OpenCode)

Templates em `social/linkedin/` + `social/whatsapp/` + `social/images/prompts/` permitem ao OpenCode gerar `weekly LinkedIn/WhatsApp, release, tutorial, deep dive, carousel, slide deck, image prompt, community announcement` **derivado do repo real**, sem inventar features. Ver `CONTENT-WORKFLOW.md`.

## Métricas

- Conteúdo: `weekly posts publicados`, `lessons → posts` conversão.
- Produto: `npx init` + `demo COMPLETED` + `doctor PASS` (evidence).
- Comunidade: `LEARN→CONTRIBUTE` loop fechado (PRs, issues, discussions).
