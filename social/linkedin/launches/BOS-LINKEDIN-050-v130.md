# BOS-LINKEDIN-050 — Launch: BehaviorOS v1.3.0 (P1 Production)

> Source: `CHANGELOG.md: v1.3.0` · Pillars [1,15] · STABLE · Evidence: `docs/OS-100-REPORT.md`, `pnpm doctor PASS`

**Hook:** v1.3.0 — 6 ADRs + 12 DNAs + OS 100%.

**Body:**
`CHANGELOG.md v1.3.0` — P1 Production: `ADR 006 control-plane versioning`, `007 mcp marketplace 45`, `008 sdk ports`, `009 knowledge federation`, `010 dna patterns v2`, `011 plugin v2 migration`.

Gates: `pnpm install → typecheck → test 401/401 → demo → demo:parallel → demo:autonomous → doctor → build` — todos PASS. Evidence: `behavior-os/runtime/demo.json` COMPLETED + Graphify 1858 nodes fresh + LangGraph 8 nodes + MCP 45 tools valid + federation valid.

Install:
```bash
npx behavior-os init --preset enterprise-governance
# ou
npm i -g behavior-os
```

**CTA:** `school-bos/00-orientation/README.md` para começar + `docs/CHANGELOG.md` para detalhes.

**Hashtags:** #Launch #BehaviorOS #OpenSource

**Visual:** Launch hero (v1.3.0 badge, 12 DNAs, 45 tools). Prompt: `../images/prompts/launch-hero.md`
