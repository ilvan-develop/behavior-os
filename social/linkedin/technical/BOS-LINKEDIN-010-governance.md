# BOS-LINKEDIN-010 — Fail-closed Governance: OPA + 4 Actions

> Source: BOS-LESSON-050 · Pillars [3,4] · Status STABLE · Verified 2026-09-03
> Evidence: `dnas/enterprise-governance.yaml:28-51`, `packages/governance/policy.rego`, `src/core/governance-engine.ts`

**Hook:** Seu agente fez `deploy-production` sem aprovação? Com BOS, isso é `block`.

**Body:**
4 ações, 1 engine, 0 ambiguidade:

| Condição | Ação | Auto-approve? | Quem decide |
|----------|------|---------------|-------------|
| `risk:high, requiresApproval:false` | `block` | ❌ | humano |
| `risk:medium, behaviorLevel:5` | `escalate` | ❌ | security reviewer |
| `risk:low` | `warn` | ✅ | plugin auto |
| `stage:evidence` | `log` | ✅ | audit |

`packages/governance/policy.rego` (OPA) + `GovernanceEngine.govern()` com `AND` — se um `block` dispara, tudo bloqueia. `opencode.json: "*": "allow"` + `plugins/behaviorOS.ts:tool.execute.before` só auto-aprova `warn|log`.

Teste:
```bash
cat behavior-os/runtime/demo.json | python -c "import json; print(json.load(open('behavior-os/runtime/demo.json'))['governance'])"
```

**CTA:** `school-bos/05-governance/README.md` → crie sua regra `no-prisma-migration-without-review`.

**Hashtags:** #AIGovernance #OPA #BehaviorOS #AIAgents

**Visual:** Governance matrix diagram (4 actions, color: red/orange/yellow/green). Prompt: `../images/prompts/governance-matrix.md`

**Carousel:** 1) Matrix, 2) Rego snippet, 3) Evidence veredicto.

**WhatsApp:** `../../whatsapp/educational/BOS-WA-010-governance.md`
