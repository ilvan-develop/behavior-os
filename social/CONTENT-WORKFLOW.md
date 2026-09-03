# CONTENT-WORKFLOW — BehaviorOS

## Pipeline (declarativo, como BOS workflow)

```
SOURCE          Research real repo (README, AGENTS, dnas, src, evidence, graphify, doctor)
  ↓
RESEARCH        Consultar Graphify (graph.json) + docs oficiais (opencode.ai, langgraph, graphify)
  ↓
VERIFY          Rodar pnpm doctor + checar arquivo:linha + status STABLE/PLANNED
  ↓
SCHOOL LESSON   BOS-LESSON-XXX em school-bos/ (hands-on + OpenCode prompt + verification)
  ↓
TECHNICAL CONTENT  Artigo/docs em docs/ ou ADR se arquitetural
  ↓
SOCIAL CONTENT  BOS-LINKEDIN-XXX (linkedin/*) + BOS-WA-XXX (whatsapp/*)
  ↓
IMAGE           Prompt em images/prompts/ + geração (hero, architecture, infographic)
  ↓
SLIDES          BOS-SLIDE-XXX em slides/training/ (Markdown → PPT)
  ↓
WHATSAPP        Adaptação curta, conversacional, CTA comunidade
  ↓
COMMUNITY       Discussão (WhatsApp community, GitHub discussions)
  ↓
FEEDBACK        Coletar reações, dúvidas, issues
  ↓
LEARNING        Record → detect → auto (LearningEngine)
  ↓
IMPROVEMENT     Atualizar lesson/template/workflow (self-evolution)
```

## Quem faz o quê

| Stage | Agente (BOS) | Skill | Evidência |
|-------|--------------|-------|-----------|
| RESEARCH | researcher | discover | graphify query |
| VERIFY | qa | verification | pnpm doctor PASS |
| SCHOOL LESSON | architect | architecture | BOS-LESSON-XXX |
| SOCIAL | orchestrator | behavioros | BOS-LINKEDIN-XXX |
| IMAGE | implementer | implementation | prompt em images/prompts/ |
| SLIDES | architect | architecture | BOS-SLIDE-XXX |
| WHATSAPP | orchestrator | behavioros | BOS-WA-XXX |
| COMMUNITY | orchestrator | — | discussion |
| LEARNING | — | learning | wf-evolved-* |

## Como o BOS orquestra (futuro)

Workflow `content-mission.json` (a criar) com `stages: [research, verify, lesson, social, image, slides, whatsapp, community, learning]` + `handoff` + `evidence` + `autonomous` chain. Hoje, manual via templates; amanhã, `pnpm demo:autonomous` com `content` workflow.

## Handoffs

`research → planner → architect → implementer → qa → security → reviewer → evidence` (mesmo de `development.json`), adaptado para content.

## Quality gates

Ver `CONTENT-QUALITY-GATES.md` — cada artefato passa 10 checks antes de publicar.
