# BOS-LESSON-050 — Governance: block | escalate | warn | log

> Módulo 05 · STABLE · 1.3.0

## Learning objective

Escrever regras de governança determinísticas com `action` + `conditions` e entender fail-closed.

## Prerequisites

04 DNA

## Concept

Governance = `Policy as Code`. 4 ações em ordem de severidade: `block` (interrompe), `escalate` (humano), `warn` (auto-approve), `log` (audit). `GovernanceEngine` avalia `risk`, `requiresApproval`, `path`, `stage`, `behaviorLevel`. Fail-closed: se dúvida, bloqueia.

## Why it matters

Sem governance, agentes fazem `deploy-production` sem aprovação. Com, `high risk → block` exige `security-audit` workflow.

## BehaviorOS implementation

- `dnas/enterprise-governance.yaml:28-51` — 5 regras (2 block critical, escalate high, warn low, log info)
- `packages/governance/policy.rego` — OPA Rego real
- `src/core/governance-engine.ts` — `govern()` + `AND` evaluation
- `src/domain/types.ts:88-95` — `GovernanceVerdict { allowed, action, reasons, policyId }`
- `governance/policies/default.json`

## Architecture

```
action: deploy-production {agent: devops, scope: production}
  ↓ GovernanceEngine.govern()
  → evaluates [high-risk-block, protected-path-block, ...] AND
  → Verdict { allowed:false, action:"block", reasons:["high risk requires..."] }
  → opencode plugin: block|escalate → humano, warn|log → auto-approve (* allow)
```

## Hands-on

```bash
cat dnas/enterprise-governance.yaml | grep -A5 governance
cat packages/governance/policy.rego | head -n 50
cat governance/policies/default.json
# Teste:
# pnpm demo  # governance veredicto em behavior-os/runtime/demo.json: governance.verdict
cat behavior-os/runtime/demo.json | python -c "import json; print(json.load(open('behavior-os/runtime/demo.json'))['governance'])"
```

## OpenCode prompt

```
Leia dnas/enterprise-governance.yaml (governance), packages/governance/policy.rego e src/core/governance-engine.ts.
Explique as 4 ações, quando cada dispara, e o que significa fail-closed + AND.
Simule veredicto para {risk:high, requiresApproval:false} e {risk:low}.
```

## Expected result

Tabela `Condição → Ação → Auto-approve?` + 2 simulações com `allowed`/`reasons`.

## Verification

```bash
cat behavior-os/runtime/demo.json | grep -A3 governance
pnpm test 2>&1 | grep -i govern
```

## Common mistakes

- Achar que `warn` bloqueia — `warn|log` são auto-approve via `opencode.json: "*": "allow"` + `plugins/behaviorOS.ts:tool.execute.before`.
- Condições AND vs OR — engine usa AND; se uma `block` dispara, tudo bloqueia.

## Troubleshooting

Governance não bloqueou → verifique `risk` + `behaviorLevel` + `policy.rego` + `doctor` hint.

## Challenge

Escreva regra `no-prisma-migration-without-review` que `block` se `path` contém `prisma/migrations` e `stage != review`.

## Completion criteria

Cria regra custom com `action` correto e explica fail-closed em 1 frase.

---

# BOS-LESSON-051 — OPA/Rego & Audit Trail

## Learning objective

Ler `policy.rego`, entender quorum `Decision` e `audit.log` hash chain.

## Prerequisites

BOS-LESSON-050

## BehaviorOS implementation

- `packages/governance/policy.rego`
- `src/core/audit.ts` — hash chain
- `behavior-os/runtime/demo.json:governance` + `audit.log` (se habilitado)

## Hands-on

```bash
cat packages/governance/policy.rego
grep -r "audit" src/core/ --include="*.ts" | head
```

## OpenCode prompt

```
Explique OPA/Rego no BOS: onde vive policy.rego, como é avaliado, e como audit.log hash chain garante imutabilidade.
```

## Completion criteria

Explica Rego + audit chain com arquivo:linha.
