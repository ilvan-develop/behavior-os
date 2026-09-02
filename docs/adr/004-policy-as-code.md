# ADR-004 — Policy as Code (Rego + TS dual-evaluation)

**Status:** Proposed (LEARN-04) | **Data:** 2026-09-02 | **Decide:** Governance `block|escalate|warn|log` via `OPA/Rego` + fallback `TS` fail-closed

**Context:** `src/domain/policies.ts` 4 policies `AND` + `dnas/enterprise-governance.yaml` 5 rules. `packages/governance/policy.rego` era stub texto não avaliado. `Regra de Ouro` exige `audit.log` hash chain observável.

**Decision:**
* `packages/governance/policy.rego` — fonte Rego `package behavioros.governance` `allow if` + `deny contains msg`
* `packages/governance/policy.ts` — adapter `GovernancePolicy { id, regoPath, evaluate(input): Promise<Verdict> }` — tenta `OPA WASM` (`opa evaluate`), fallback `TS` `evaluateAll` (fail-closed)
* `behavior-os/runtime/audit.log` — append-only `sha256(prev+entry)` hash chain, `governanceApproved` → `evidence.governance`

**Consequences:** `v1.3.0` deve gerar `audit.log` observável + `vitest` `governance.rego` 95% + `tsconfig.packages.json` inclui `packages/governance`.
