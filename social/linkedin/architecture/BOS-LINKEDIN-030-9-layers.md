# BOS-LINKEDIN-030 — The 9 Layers OS (Architecture Deep Dive)

> Source: BOS-LESSON-011 · Pillars [4,13] · STABLE · Evidence: `README.md:66-90`, `docs/ARCHITECTURE.md`

**Hook:** Todo OS tem layers. O BOS tem 9.

**Body:**
```
Mission (intent)
Learning (record→detect→auto)
Quality (coverage≥80, lint 0, typecheck 0)
Pipeline (deterministic handoff + parallelGroups)
Governance (block|escalate|warn|log + OPA)
Behavioral (DNALoader compose)
DNA (YAML — 12 patterns)
  ↓ OpenCode (exec) + Graphify (knowledge 207) + LangGraph (durable 8)
```

Fronteiras: `src/domain` (tipos) vs `src/core` (engines) vs `adapters` (graphify/langgraph/opencode) vs `packages/*` (mcp, federation, control-plane).

**CTA:** `docs/ARCHITECTURE.md` + `school-bos/01-what-is-bos/README.md`

**Hashtags:** #Architecture #BehaviorOS #AIEngineering

**Visual:** 9 Layers diagram + fronteiras `src/` map. Prompt: `../images/prompts/architecture-9-layers.md`
