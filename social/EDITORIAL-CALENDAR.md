# EDITORIAL-CALENDAR — BehaviorOS

> Cadência semanal reutilizável. Ajuste conforme evidência (engajamento, feedback).

## Template semanal

| Dia | Tema | Pilar | Formato LinkedIn | WhatsApp | Slide |
|-----|------|-------|------------------|----------|-------|
| **SEG** | Conceito / Educação | 1,4 | educational (carrossel ou hook+body) | educational digest | — |
| **TER** | Technical deep dive | 3,5,6,7,13 | technical / architecture | technical teaser | training deck |
| **QUA** | Tutorial / Prático | 11,8,9 | tutorial (copy/paste) | onboarding step | workshop |
| **QUI** | Arquitetura / AI agents | 2,4,6,7 | architecture / thought-leadership | community prompt | presentation |
| **SEX** | Community / Building in public | 14,15 | community / building-in-public | community discussion | — |

Opcional **SÁB**: launch/release (quando houver `CHANGELOG.md` tag).

## Pacote semanal (cada post)

```
title, hook (1ª linha), body (4-7 parágrafos), CTA, hashtags,
suggested visual, image-generation prompt, optional carousel (3-5 slides),
WhatsApp adaptation, source lesson (BOS-LESSON-XXX), verification status (STABLE/EXPERIMENTAL),
version (1.3.0), last verified
```

## Exemplo: Semana 1 (Foundation)

- SEG BOS-LINKEDIN-001: "What is BehaviorOS? (9 Layers in 1 diagram)" → `01-what-is-bos` · pillars [1,4]
- TER BOS-LINKEDIN-002: "Fail-closed governance: block vs warn" → `05-governance` · [3]
- QUA BOS-LINKEDIN-003: "Your first mission in 5 min (pnpm demo)" → `03-first-mission` · [11,8]
- QUI BOS-LINKEDIN-004: "Graphify: your repo as 207-node graph" → `09-graphify` · [6,4]
- SEX BOS-LINKEDIN-005: "Building in public: OS 100% report" → `docs/OS-100-REPORT.md` · [15,14]

Ver `social/linkedin/weekly/WEEK-01.md` para pacote completo.

## Exemplo: Semana 2 (Builder)

- SEG: DNA 12 patterns
- TER: OpenCode * allow + plugin auto-approve
- QUA: LangGraph StateGraph 8 + MemorySaver
- QUI: MCP 45 tools
- SEX: Capstone preview

## Operação

1. Escolha semana → copie template → preencha `source lesson` + `verification`.
2. Gere imagem com `social/images/prompts/` (hero/architecture).
3. Adapte para WhatsApp (`social/whatsapp/weekly/WEEK-01.md`).
4. Valide com `CONTENT-QUALITY-GATES.md` checklist.
5. Publique LinkedIn + WhatsApp + colete feedback → `learning`.

## Automação futura (BOS como orquestrador)

```
CONTENT MISSION (autonomous workflow)
  Research (Graphify) → Curriculum (learn) → Lesson → LinkedIn/WhatsApp/Slides/Image → Community → Feedback → LearningEngine → Improve
```
Ver `CONTENT-WORKFLOW.md`.
