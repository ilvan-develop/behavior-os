# BehaviorOS Community — Content Production System

> **School = aprender. Community = participar. GitHub = construir. BehaviorOS = produto.**

`social/` é o sistema oficial de produção de conteúdo do BehaviorOS. Transforma conhecimento do `school-bos/` + código real em conteúdo distribuível (LinkedIn, WhatsApp, slides, imagens) com rastreabilidade e quality gates.

```
SOURCE (repo, graphify, evidence)
  ↓ RESEARCH (verificar)
  ↓ SCHOOL LESSON (BOS-LESSON-XXX)
  ↓ TECHNICAL CONTENT
  ↓ SOCIAL CONTENT (LinkedIn BOS-LINKEDIN-XXX)
  ↓ IMAGE (prompt)
  ↓ SLIDES (BOS-SLIDE-XXX)
  ↓ WHATSAPP (BOS-WA-XXX)
  ↓ COMMUNITY
  ↓ FEEDBACK → LEARNING → IMPROVE
     (fecha o loop LEARN→BUILD→SHARE→DISCUSS→CONTRIBUTE→TEACH→IMPROVE)
```

## Estrutura

```
social/
├── README.md, BRAND-DNA.md, CONTENT-STRATEGY.md, CONTENT-PILLARS.md
├── EDITORIAL-CALENDAR.md, CONTENT-WORKFLOW.md, CONTENT-QUALITY-GATES.md, INDEX.md
├── linkedin/ (weekly, technical, educational, thought-leadership, architecture, tutorials, launches, community, building-in-public)
├── whatsapp/ (community, announcements, educational, onboarding, weekly, events, launches)
├── images/prompts/, images/templates/, images/campaigns/
├── slides/training/, slides/workshops/, slides/presentations/
└── campaigns/
```

## Princípios

- **Nada inventado.** Todo post rastreável a `BOS-LESSON-XXX` + arquivo:linha + `version` + `status`.
- **Visual honesto.** Nunca fake screenshot; prompts de imagem preservam identidade BOS.
- **Não-spam.** WhatsApp = curto, conversacional, CTA para comunidade com valor educacional.

## Uso rápido

1. Escolha `CONTENT-PILLARS.md` pillar.
2. Siga `CONTENT-WORKFLOW.md` (SOURCE→FEEDBACK).
3. Use template em `linkedin/` ou `whatsapp/`.
4. Gere imagem com `images/prompts/`.
5. Valide com `CONTENT-QUALITY-GATES.md`.
6. Publique e colete feedback → `LEARNING`.

## Versionamento

Todo artefato: `BehaviorOS 1.3.0`, `status: STABLE|EXPERIMENTAL|PLANNED|DEPRECATED`, `last verified`, `source lesson`.

Veja `INDEX.md` para índice navegável e `SCHOOL-AND-COMMUNITY.md` na raiz.
