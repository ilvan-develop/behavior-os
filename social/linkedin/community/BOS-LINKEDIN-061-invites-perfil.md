# BOS-LINKEDIN-061 — Convites por Perfil (CTO · Dev · Researcher · Estudante · OSS)

> BOS-LINKEDIN-061 · Source: `social/BRAND-DNA.md` + `docs/OS-100-REPORT.md` v1.3.0 · Pillars: [14] · Status: STABLE · Verified: 2026-09-03
> Evidence: `behavior-os/runtime/demo.json` COMPLETED + `pnpm test` 401/401 + `graphify-out/graph.json` 1858 nodes fresh + `pnpm doctor` PASS

# Convites prontos para copiar/colar no LinkedIn

Regra: 1 perfil = 1 dor + 1 prova + 1 CTA. Sem superlativo vazio. Sempre cite evidence.

---

## 1. Para CTO / Tech Lead — dor: governança

**Mensagem de conexão (290 caracteres):**
> Olá {nome}, vi seu trabalho com {stack/time}. Lidero behaviorOS — OS para times de IA com governança fail-closed (block|escalate|warn|log) + evidence COMPLETED por missão. 401/401 tests. Aberto a trocar sobre pipelines determinísticos?

**Follow-up após aceitar:**
> Obrigado por conectar, {nome}. O que resolve para CTO: `Mission → Governance → Pipeline → Evidence`. Cada missão gera `behavior-os/runtime/*.json` com `status: COMPLETED`, `overall 100`, `traces W3C`, `mcp valid`, `federation valid`. Nada de "agente fez, ninguém viu".
>
> Prova: `docs/OS-100-REPORT.md` v1.3.0 + `pnpm doctor` PASS.
> Começo de 5 min: `npx behavior-os init` (preserva `src/`) → `pnpm demo` → `cat behavior-os/runtime/demo.json | grep COMPLETED`.
> Quer que eu rode o `doctor` num repo seu e te mostre o relatório?

**CTA:** `school-bos/00-orientation/README.md` + call de 15 min sobre `behavior-os/workflows/development.json`.
**Hashtags:** #BehaviorOS #AIAgents #Governance #CTO

---

## 2. Para Dev Backend — dor: pipeline imprevisível

**Mensagem de conexão:**
> Fala {nome}, vi seus PRs em {repo/stack}. Trabalho em behaviorOS — 8 stages declarativos (discover→evidence) com handoffs validados, não prompt gigante. 401 testes passando. Quer ver o `pnpm demo` rodando?

**Follow-up:**
> Valeu, {nome}. Para dev: workflow é `behavior-os/workflows/development.json` — `discover(researcher)→plan→architect→implement→test(qa)→security→review→evidence`. Stage `gated` falha se `coverage.tests < 80`. `test+security` rodam em `parallelGroups` via `Promise.all`.
>
> Stack real: `src/workflow/engine.ts` + `src/workflow/langgraph-graph.ts` (StateGraph 8 nodes + MemorySaver) + `src/core/governance.ts` (4 policies AND fail-closed).
> Teste você mesmo: `git clone https://github.com/ilvan-develop/behavior-os.git` → `pnpm install` → `pnpm test` → `pnpm demo`.

**CTA:** `social/linkedin/tutorials/BOS-LINKEDIN-040-first-mission.md`
**Hashtags:** #BehaviorOS #TypeScript #OpenCode #LangGraph

---

## 3. Para AI Researcher — dor: conhecimento sem autoridade

**Mensagem de conexão:**
> Olá {nome}, acompanho sua pesquisa em {tema}. No behaviorOS tratamos Graphify como knowledge layer, não autoridade: `graphify-out/graph.json` (1858 nodes) + `federated.json` com provenance por nó. Interessado em trocar sobre federation determinística?

**Follow-up:**
> {nome}, detalhe técnico que pode te interessar: `packages/knowledge/federation.ts` faz `merge()` deduplicado por `id` com `provenance {source, sources, hash}`. Regra `local wins` — host nunca sobrescrito por cache global. `stats {totalBeforeDedup, totalAfterDedup, deduped, conflicts}` auditável em `evidence.federation`.
>
> Spec: `docs/adr/009-knowledge-federation.md` (361 linhas, decisão + alternativas rejeitadas).
> Repro: `python -m graphify extract . --code-only` → `pnpm demo` → `cat graphify-out/federated.json | grep totalAfterDedup`.

**CTA:** `docs/adr/009-knowledge-federation.md` + discussão sobre `provenance` vs RAG clássico.
**Hashtags:** #BehaviorOS #Graphify #KnowledgeGraph #Research

---

## 4. Para Estudante — dor: por onde começar

**Mensagem de conexão:**
> Oi {nome}, vi que estuda {curso/stack}. O behaviorOS tem trilha gratuita: 15 módulos em `school-bos/` + comunidade LEARN→BUILD→SHARE. Começa com `npx behavior-os init` em 5 min. Quer o roteiro?

**Follow-up:**
> Roteiro de 5 min, {nome}:
> 1. `mkdir my-saas && cd my-saas` + `npx behavior-os init` (não apaga seu `src/`)
> 2. `pnpm install` → `pnpm demo` → abre `behavior-os/runtime/demo.json`
> 3. Compartilha o `COMPLETED` na comunidade e ganha feedback com `arquivo:linha`.
>
> Depois: `school-bos/00-orientation/README.md` → 3 tracks (conceito, técnico, produção). Tudo com evidence, nada decorado.

**CTA:** `school-bos/00-orientation/README.md` → `social/whatsapp/onboarding/BOS-WA-001-welcome.md`
**Hashtags:** #BehaviorOS #LearnInPublic #Estudantes

---

## 5. Para Open-Source Contributor — dor: contribuir sem guia

**Mensagem de conexão:**
> Oi {nome}, vi suas contribuições em {repo}. behaviorOS é MIT, com `AGENTS.md` como regra persistente + gates `install→typecheck→test→demo→doctor→build` que bloqueiam entrega se 1 falha. Quer um good-first-issue guiado por evidence?

**Follow-up:**
> Como contribuir sem adivinhar, {nome}: `AGENTS.md` + `docs/ARCHITECTURE.md` definem fronteiras (`src/domain` vs `src/core` vs `adapters`). Cada PR precisa de `vitest` passando (401/401 hoje) + `evidence` em `behavior-os/runtime/`.
>
> Good first: atualizar `social/` (como este post), revisar `dnas/*.yaml`, ou cobrir `edge case` em `packages/*/`. Tudo com `file:line` refs, sem prompt gigante.

**CTA:** `CONTRIBUTING.md` + `https://github.com/ilvan-develop/behavior-os` issues.
**Hashtags:** #OpenSource #BehaviorOS #Contribute

---

**Visual:** 5 cards por perfil (dor → prova → CTA). Prompt: `../images/prompts/community-loop.md` (variação: avatar por persona + badge 401/401 + 1858 nodes).
**Carousel (5 slides):** 1 por perfil — título = dor, corpo = prova + comando copy/paste, rodapé = CTA.
**WhatsApp adaptation:** `../../whatsapp/community/BOS-WA-061-invites-perfil.md`
