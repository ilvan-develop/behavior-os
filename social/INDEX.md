# INDEX — BehaviorOS Community

## Core

- [README](./README.md) — sistema de produção
- [BRAND-DNA](./BRAND-DNA.md) — posicionamento, voz, terminologia
- [CONTENT-STRATEGY](./CONTENT-STRATEGY.md) — audiências, funil, cadência, métricas
- [CONTENT-PILLARS](./CONTENT-PILLARS.md) — 15 pilares
- [EDITORIAL-CALENDAR](./EDITORIAL-CALENDAR.md) — semanal Seg→Sex + pacote
- [CONTENT-WORKFLOW](./CONTENT-WORKFLOW.md) — SOURCE→IMPROVEMENT pipeline
- [CONTENT-QUALITY-GATES](./CONTENT-QUALITY-GATES.md) — 10 gates

## LinkedIn

| Pasta | Conteúdo | Exemplo |
|-------|----------|---------|
| [weekly](./linkedin/weekly/) | Pacotes semanais completos | `WEEK-01.md` |
| [technical](./linkedin/technical/) | Deep dives | `BOS-LINKEDIN-010-governance.md` |
| [educational](./linkedin/educational/) | Conceito, 9 layers | `BOS-LINKEDIN-001-what-is-bos.md` |
| [thought-leadership](./linkedin/thought-leadership/) | Opinião, arquitetura | `BOS-LINKEDIN-020-autonomous-teams.md` |
| [architecture](./linkedin/architecture/) | Diagramas, ADRs | `BOS-LINKEDIN-030-9-layers.md` |
| [tutorials](./linkedin/tutorials/) | Copy/paste | `BOS-LINKEDIN-040-first-mission.md` |
| [launches](./linkedin/launches/) | Releases | `BOS-LINKEDIN-050-v130.md` |
| [community](./linkedin/community/) | Convites | `BOS-LINKEDIN-060-join-community.md` |
| [building-in-public](./linkedin/building-in-public/) | OS-100, changelog | `BOS-LINKEDIN-070-os100.md` |

Templates: `technical-post`, `educational`, `architecture`, `tutorial`, `launch`, `community`, `building-in-public` — ver `linkedin/README.md`.

## WhatsApp

| Pasta | Conteúdo |
|-------|----------|
| [onboarding](./whatsapp/onboarding/) | Boas-vindas, 5min start |
| [announcements](./whatsapp/announcements/) | Releases, eventos |
| [educational](./whatsapp/educational/) | Dicas curtas |
| [community](./whatsapp/community/) | Discussão, convite |
| [weekly](./whatsapp/weekly/) | Digest semanal (adapta LinkedIn) |
| [events](./whatsapp/events/) | Workshops |
| [launches](./whatsapp/launches/) | Launch adaptation |

## Images & Slides

- `images/prompts/` — hero, architecture, agent viz, knowledge graph, autonomous team, workflow, infographic, carousel cover, announcement, community invitation (10 templates)
- `images/templates/` — descrições reutilizáveis
- `slides/training/` — 10 decks Markdown (BOS Intro, Architecture, OpenCode, Graphify, LangGraph, Autonomous Teams, Governance, DNA, Production, Capstone) — ver `slides/training/INDEX.md`

## Campaigns

- `campaigns/` — campanhas integradas (ex: `launch-v130/`, `school-launch/`)

## Rastreabilidade

```
BOS-LESSON-XXX (school-bos/)
  ↔ BOS-LINKEDIN-XXX (linkedin/*)
  ↔ BOS-WA-XXX (whatsapp/*)
  ↔ BOS-SLIDE-XXX (slides/*)
  ↔ graphify node (knowledge)
```

Use IDs estáveis para navegar via Graphify.
