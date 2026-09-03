# BOS-LINKEDIN-040 — Your First Mission in 5 min

> Source: BOS-LESSON-030 · Pillars [11,8] · STABLE · Evidence: `pnpm demo → behavior-os/runtime/demo.json COMPLETED`

**Hook:** Copie, cole, prove.

**Body:**
```bash
npx behavior-os init --preset enterprise-governance
pnpm install
pnpm demo && cat behavior-os/runtime/demo.json | grep COMPLETED
pnpm doctor 2>&1 | grep "overall: PASS"
```

O que aconteceu: `createMission → startMission → 8 stages (discover→evidence) → evaluator overall 100 → traces W3C + mcp 45 + federated`.

Próximo: `school-bos/03-first-mission/README.md` tem SDK snippet (`BehaviorOS.createMission`).

**CTA:** Rode `pnpm demo:parallel` e veja `test+security` em `Promise.all`.

**Hashtags:** #Tutorial #BehaviorOS #OpenCode

**Visual:** Terminal screenshot estilizado (não fake — use `pnpm demo` real). Prompt: `../images/prompts/tutorial-terminal.md`
