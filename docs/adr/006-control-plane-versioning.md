# ADR 006 — Control Plane Versioning (Semver + FeatureFlags + DNA fallback)

**Status:** Proposed | **Versão:** behaviorOS v1.3.0 | **Data:** 2026-09-02 | **Decide:** Control Plane `Versioning` Semver + `FeatureFlags.isEnabled` fail-closed + DNA fallback + `evidence.version` + `behavior-os/state/control-plane.json`
**Relacionados:** ADR 001 (Core boundaries), ADR 002 (Evidence-first), ADR 003 (Bootstrap), ARCHITECTURE v1.1 (Kernel/Mission Engine/Evidence), `src/domain` vs `src/core` vs `adapters`

---

## Contexto

`v1.2.0` entregou `packages/control-plane/versioning.ts` como utilitário ad-hoc sem contrato formal, sem Semver e com bug crítico de precedência em `isFeatureEnabled`. O princípio `Mission → Workflow Engine → Agents → Skills → Governance → Evidence` exige que versionamento e feature flags sejam **contratos auditáveis** com evidência observável, não `env` volátil.

### Bug crítico — `isFeatureEnabled` ternário invertido

```ts
// packages/control-plane/versioning.ts — BUG v1.2.0
export function isFeatureEnabled(flag: string): boolean {
  return process.env[`FEATURE_${flag.toUpperCase()}`] === "true" || flag === "canary" ? false : true;
}
```

Precedência JS/TS: `||` tem prioridade sobre `?:` mas **menor** que `===`, logo a expressão é avaliada como:

```ts
(process.env[`FEATURE_${flag.toUpperCase()}`] === "true" || flag === "canary") ? false : true
```

Consequências:
- `flag === "canary"` **sempre** retorna `false` (canary travado, nunca habilitável, mesmo com `FEATURE_CANARY=true` → `(true || true) ? false : true` = `false`).
- Qualquer flag sem `env=true` retorna `true` (default **aberto**, viola fail-closed): `isFeatureEnabled("x")` → `(false || false) ? false : true` = `true`.
- Inverte fail-closed para fail-open: flags não declaradas ficam habilitadas por padrão — risco de governança e `security` bypass.

Objetivo `v1.3.0 (LEARN-06)`: corrigir o bug, definir contrato **sem implementar código além do fix mínimo**, que permita versionar `behavior-os/workflows/*.json` via Semver, controlar flags com default `false` + DNA fallback e persistir estado observável em `behavior-os/state/control-plane.json` e `evidence.version`.

---

## Decisão

### 1. Fronteiras (respeito a `src/domain` vs `src/core` vs `adapters`)

```
src/domain/versioning.ts          → contratos (Versioning, FeatureFlags, Semver, ControlPlaneState)
src/domain/types.ts               → estende Evidence com `version`
src/core/mission-engine.ts        → orquestra via Versioning/FeatureFlags injetados (não lê env/dna direto)
packages/control-plane/*          → adapters (único lugar que lê process.env + behavior-os/dna/*.yaml + workflows/*.json)
behavior-os/state/control-plane.json → estado durável observável (Regra de Ouro)
behavior-os/runtime/<mission>.json   → evidence.version (snapshot por missão)
```

`Kernel` e `src/core` nunca importam `process.env` nem `fs` direto para flags/version. `evidence-ledger.ts` compõe `Evidence.version` a partir do Control Plane.

### 2. Correção `isFeatureEnabled` — fail-closed com parênteses + DNA fallback

**Antes (bug):**
```ts
return process.env[`FEATURE_${flag.toUpperCase()}`] === "true" || flag === "canary" ? false : true;
```

**Depois (corrigido):**
```ts
// packages/control-plane/versioning.ts — FIX v1.3.0
export function isFeatureEnabled(flag: string): boolean {
  const envKey = `FEATURE_${flag.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal === "true") return true;
  if (envVal === "false") return false;
  // DNA fallback — último fallback é false (fail-closed)
  const dnaVal = getDnaFlag(flag); // lê behavior-os/dna/*.yaml → flags: Record<string, boolean>
  if (typeof dnaVal === "boolean") return dnaVal;
  return false; // default false — nunca true implícito
}

// Alternativa equivalente curta (se sem DNA):
// return (process.env[`FEATURE_${flag.toUpperCase()}`] === "true") ? true : (getDnaFlag(flag) ?? false);
```

**Regras:**
- `env` tem precedência sobre `DNA`; `DNA` sobre `default`.
- `default` é **sempre** `false` (fail-closed). Flag inexistente → `false`.
- `canary` deixa de ser caso especial; é flag como qualquer outra (`canary: false` por padrão, habilitável via `FEATURE_CANARY=true` ou `dna.flags.canary: true`).
- Sem `||` + ternário sem parênteses; usar `if` early-return ou `(cond) ? true : false` com parênteses explícitos.

Invariante validável em teste:
```ts
expect(isFeatureEnabled("canary")).toBe(false); // sem env/dna
process.env.FEATURE_CANARY = "true";
expect(isFeatureEnabled("canary")).toBe(true);  // canary habilitável
delete process.env.FEATURE_CANARY;
expect(isFeatureEnabled("unknown_flag_xyz")).toBe(false); // fail-closed
```

### 3. Contrato `Versioning` — Semver `patch|minor|major`

```ts
// src/domain/versioning.ts — sem dependência fs/env, apenas tipos
export const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export type SemverBump = "patch" | "minor" | "major";

export interface WorkflowVersion {
  workflowId: string;
  version: string; // Semver válido
  bump: SemverBump | null; // último bump aplicado
  updatedAt: string; // ISO-8601
}

export interface Versioning {
  /** Lê version de workflows/<id>.json (fallback "0.0.0" se ausente/corrompido) */
  getWorkflowVersion(workflowId: string): string;
  /** Valida Semver (regex acima, sem leading zeros) */
  isValidSemver(version: string): boolean;
  /** Calcula próximo Semver sem mutar disco: bump("1.2.3","minor") → "1.3.0" */
  bumpVersion(current: string, type: SemverBump): string;
  /** Persiste bump em workflows/<id>.json + atualiza control-plane.json */
  bumpWorkflowVersion(workflowId: string, type: SemverBump): WorkflowVersion;
  /** Lista todas as versões observáveis */
  listVersions(): Record<string, string>; // { development: "2.1.0", ... }
}
```

**Semântica bump (Semver 2.0.0):**
- `major`: `X.Y.Z → (X+1).0.0` — quebra compatibilidade `stages`/`handoffs`/`behaviorLevel`.
- `minor`: `X.Y.Z → X.(Y+1).0` — nova feature compatível (novo stage opcional, flag).
- `patch`: `X.Y.Z → X.Y.(Z+1)` — fix compatível (correção de prompt, docs, bug `isFeatureEnabled`).
- `bumpVersion("0.0.0", "patch") → "0.0.1"`; inválido lança `Error("Invalid Semver")`.

### 4. Contrato `FeatureFlags` — `isEnabled` com `default false` + DNA fallback

```ts
// src/domain/versioning.ts (continuação)
export type FlagSource = "env" | "dna" | "default";

export interface FlagEvaluation {
  flag: string;
  enabled: boolean;
  source: FlagSource;
  rawEnv?: string;      // process.env[FEATURE_FLAG] se existir
  dnaValue?: boolean;   // valor em DNA se existir
}

export interface FeatureFlags {
  /** Fail-closed: default false se env e DNA ausentes */
  isEnabled(flag: string): boolean;
  /** Auditoria: de onde veio a decisão */
  evaluate(flag: string): FlagEvaluation;
  /** Lista flags conhecidas (env + dna) */
  listFlags(): Record<string, FlagEvaluation>;
}

// DNA fallback — packages/control-plane/dna-flags.ts
// Lê behavior-os/dna/system.dna.yaml + project.dna.yaml → `flags: { canary: false, useLangGraph: false }`
// Se `flags` ausente, equivale a {} (tudo false).
```

**Precedência:** `env ("true"|"false" exato, case-sensitive)` > `dna.flags[flag] (boolean)` > `default false`. `env` diferente de `"true"/"false"` é ignorado (tratado como ausente, cai para DNA).

### 5. `evidence.version` — snapshot por missão

**Extensão em `src/domain/types.ts`:**
```ts
export interface Evidence {
  // ...existentes (missionId, workflowId, status, stages, governance, ...)
  version: string; // Semver do workflow no momento da missão (snapshot de getWorkflowVersion(workflowId))
  controlPlane?: {
    workflowVersion: string;
    flags: Record<string, boolean>; // snapshot dos flags avaliados na missão
  };
}
```

**Regras:**
- `mission-engine.ts` ao iniciar missão: `evidence.version = versioning.getWorkflowVersion(mission.workflowId)`.
- `evidence.controlPlane.flags` persiste `featureFlags.listFlags()` filtrado para flags usadas na missão (ex: `canary`, `useOtel`).
- Evidência é imutável após `COMPLETED`; `version` permite auditar qual Semver gerou o artefato.

### 6. Estado durável `behavior-os/state/control-plane.json` — evidência observável

**Artefato (Regra de Ouro):**
```json
{
  "version": "1.3.0",
  "updatedAt": "2026-09-02T15:31:53.793Z",
  "workflows": {
    "development": "2.1.0",
    "autonomous": "1.0.0",
    "incident": "1.0.0"
  },
  "flags": {
    "canary": { "enabled": false, "source": "default" },
    "useLangGraph": { "enabled": false, "source": "dna" }
  },
  "lastBump": { "workflowId": "development", "from": "2.0.9", "to": "2.1.0", "type": "minor", "at": "2026-09-02T15:31:53.793Z" }
}
```

**Contrato:**
- `behavior-os/state/control-plane.json` é **única fonte observável** do Control Plane (fail-closed se ausente/corrompido → `doctor` falha).
- `packages/control-plane/store.ts` → `readControlPlaneState(): ControlPlaneState` + `writeControlPlaneState(state): void` (único escritor).
- `control-plane.json` atualizado em: `bumpWorkflowVersion()` e `mission-engine` (flags snapshot) e `init` (bootstrap).
- `pnpm doctor` verifica: `existsSync(statePath)` + `JSON.parse` + `SEMVER_RE.test(version)` + `workflows[mission.workflowId]` existe.

### 7. Integração com Bootstrap e Gates

```
pnpm install → pnpm typecheck → pnpm test → pnpm demo → pnpm doctor
                              ↘ vitest: isFeatureEnabled fail-closed + Semver bump + evidence.version
                                                        ↘ doctor: control-plane.json exists + Semver válido
```

- `vitest` deve cobrir: canary false→true via env, default false, DNA fallback, `bumpVersion` patch/minor/major, `isValidSemver` rejeita `01.0.0`.
- `pnpm demo` deve gerar `behavior-os/runtime/demo.json` com `version` e `controlPlane.flags`.
- `behavior-os/state/control-plane.json` deve existir após `demo` (Regra de Ouro: `Configuração não é integração`).

---

## Consequências

**Positivas:**
- Bug `isFeatureEnabled` eliminado; `canary` habilitável e flags fail-closed (governança preservada).
- Semver padroniza `bump patch|minor|major` para `workflows/*.json` com auditoria `lastBump`.
- `FeatureFlags` com DNA fallback permite `behavior-os/dna/*.yaml` controlar rollout sem `env` (ex: `canary` por projeto).
- `evidence.version` + `control-plane.json` fecham Regra de Ouro: versionamento é evidência, não declaração.
- `src/core` desacoplado de `env/fs`; testes usam `InMemoryVersioning`/`NoopFlags` sem I/O.

**Negativas / Mitigações:**
- Duplo snapshot (`evidence.version` + `control-plane.json`) → mitigado por `controlPlane.workflows` ser agregador e `evidence.version` ser snapshot pontual (link, não duplicação divergente).
- Leitura de `dna/*.yaml` adiciona I/O → mitigado por cache em `packages/control-plane/dna-flags.ts` com `mtime` e fallback `{}`.
- `bumpWorkflowVersion` muta `workflows/*.json` → mitigado por `doctor` validar Semver e `git diff` auditar bump.

**Gates v1.3.0 (contrato, não exige implementação completa além do fix):**
- [ ] `src/domain/versioning.ts` com `Versioning`, `FeatureFlags`, `SEMVER_RE`, `SemverBump`
- [ ] `packages/control-plane/versioning.ts` corrigido (`isFeatureEnabled` com DNA fallback e default false)
- [ ] `packages/control-plane/store.ts` → `behavior-os/state/control-plane.json` (read/write)
- [ ] `src/domain/types.ts` estendido com `Evidence.version` + `Evidence.controlPlane`
- [ ] `src/core/evidence-ledger.ts` persiste `version` + `controlPlane.flags`
- [ ] `behavior-os/state/control-plane.json` gerado em `demo` com `workflows` + `flags`
- [ ] `vitest` → `isFeatureEnabled canary`, `default false`, `DNA fallback`, `bump patch|minor|major`, `SEMVER_RE`
- [ ] `pnpm doctor` verifica `control-plane.json` + `evidence.version` Semver válido

## Alternativas Consideradas

1. **Manter ternário sem parênteses + `|| canary`** — rejeitado: bug de precedência, canary travado, fail-open.
2. **Flags só via `env`** — rejeitado: sem DNA fallback não há rollout por projeto; `env` é volátil e não auditável por missão.
3. **Version em `package.json` apenas** — rejeitado: `workflows/*.json` têm ciclo próprio (ex: `development@2.1.0` vs `behavior-os@1.3.0`); package version não reflete bump de workflow.
4. **Sem `control-plane.json`, só `evidence.version`** — rejeitado: viola Regra de Ouro; estado global precisa ser observável fora de `runtime/<mission>.json` para `doctor` gatear sem missão.
5. **Default `true` para flags (fail-open)** — rejeitado: viola `security` e `governance`; flag desconhecida habilitada expõe `canary`/`langgraph` sem aprovação.

## Referências

- `docs/ARCHITECTURE.md` v1.1 — Fronteiras Kernel/Mission Engine/Evidence/OpenCode/Graphify/LangGraph
- `src/domain/types.ts` → `Evidence` + `Workflow` (`version: string`)
- `src/core/evidence-ledger.ts` → `evidencePath()` + `write()`
- `packages/control-plane/versioning.ts` (BUG) → `isFeatureEnabled` ternário invertido + ausência de `Versioning`/`FeatureFlags`
- `behavior-os/workflows/*.json` → `version` Semver (ex: `development@2.1.0`)
- `behavior-os/dna/*.yaml` → `flags` (system/project DNA)
- `behavior-os/state/control-plane.json` (novo) → estado durável observável
- `behavior-os/runtime/<mission>.json` → `evidence.version` snapshot
- Semver 2.0.0: https://semver.org/ — `MAJOR.MINOR.PATCH`
- ADR 001 (Core boundaries), ADR 002 (Evidence-first), ADR 003 (Bootstrap)

> **Nota:** Este ADR é **especificação**. O único código exigido em `v1.3.0` além do contrato é o fix de `isFeatureEnabled` (parênteses + DNA fallback + default false). Demais gates são critérios de aceite quando o Control Plane for implementado.
