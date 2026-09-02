# ADR 008 - SDK Ports (Public Surface sem `../../src`)

**Status:** Proposed | **Versao:** behaviorOS v1.3.0 | **Data:** 2026-09-02 | **Decide:** `Sdk Port` como unica superficie publica do pacote `behavior-os` - `package.json#name="behavior-os"` + `exports` + `src/domain/ports.ts` - proibicao de `../../src` em `packages/*`
**Relacionados:** ADR 001 (Core boundaries), ADR 002 (Evidence-first), ADR 003 (Bootstrap), ARCHITECTURE v1.1 (Kernel/Mission Engine/Evidence), `src/domain` vs `src/core` vs `adapters`

---

## Contexto

`v1.2.0` entregou `packages/sdk/index.ts` como fachada ad-hoc:

```ts
// packages/sdk/index.ts - VIOLACAO v1.2.0
import { executeMission } from "../../src/core/mission-engine.js";
import { recordLearning } from "../../src/core/learning.js";
```

Problemas sem ADR:

- **`../../src` quebra publicacao.** `package.json` declara `name: "behavior-os"` e `files: ["dist/","src/","behavior-os/",...]`. Quando publicado no npm, consumidor faz `import { BehaviorOS } from "behavior-os"`; o SDK interno nao pode resolver `../../src` fora do monorepo. O mesmo arquivo que funciona localmente quebra em `npm pack` / `npx behavior-os init` em host externo.
- **Quebra ADR 001.** `src/core` e kernel; `packages/*` sao adapters. Import relativo acopla adapter ao caminho fisico, impede injecao e teste com `InMemoryPort`/`NoopPort` sem I/O.
- **Sem `exports` nao ha superficie publica.** `package.json` atual nao declara `exports`, logo `import "behavior-os/domain"` resolve por acidente via `src/` exposto, nao por contrato - polui API publica com internos.
- **Sem `Sdk Port` nao ha fronteira governavel.** `executeMission` e `recordLearning` chamados direto impedem `governance` interceptar e `evidence` auditar invocacoes do SDK (diverge de ADR 004/007 onde `Gateway` e a unica via).
- **Soberania do host violada.** Host (`my-saas/`) que instala `behavior-os` nao deve conter `src/` do OS; SDK deve ser consumivel como dependencia npm, nao copia de arquivos.
- **Grep `\.\./\.\./src` detecta 14 ocorrencias em `packages/*`** (sdk, orchestrator, dna, kernel, knowledge, adapters) - divida tecnica portavel.

Objetivo `v1.3.0 (LEARN-08)`: definir contrato **sem implementar codigo alem do esqueleto de tipos + `package.json#exports`**, que permita ao SDK importar apenas de `behavior-os` (nome publicado), manter `src/core` injetavel via Ports e gerar evidencia observavel gateavel por `pnpm doctor`/`audit`.

---

## Decisao

### 1. Fronteiras (respeito a `src/domain` vs `src/core` vs `adapters`)

```
src/domain/types.ts              -> tipos canonicos (Mission, Workflow, Evidence)
src/domain/ports.ts              -> contratos Sdk Ports (interfaces puras, sem fs/process/zod)
src/domain/versioning.ts         - Versioning/FeatureFlags (ADR 006)
src/domain/mcp.ts                -> McpMarketplace/Gateway (ADR 007)
src/domain/tracing.ts            - TracingProvider (ADR 005)
src/core/mission-engine.ts       - implementa MissionPort/WorkflowPort injetando Ports
src/core/learning.ts             -> implementa LearningPort
src/core/evidence-ledger.ts      - implementa EvidencePort
packages/sdk/*                   -> adapter SDK - UNICO lugar que expoe class BehaviorOS; nunca importa "../../src/*"
packages/* (outros)              -> adapters - importam apenas de "behavior-os" ou "behavior-os/ports" ou "behavior-os/domain"
dist/src/*                       -> artefato compilado publicado (package.json files)
behavior-os/runtime/sdk.json     - evidencia observavel do SDK (Regra de Ouro)
```

**Regra de ouro de import:**

- OK `import { executeMission } from "behavior-os"`  (via `exports["."]`)
- OK `import type { Mission } from "behavior-os/domain"` (via `exports["./domain"]`)
- OK `import type { MissionPort } from "behavior-os/ports"` (via `exports["./ports"]`)
- FAIL `import { executeMission } from "../../src/core/mission-engine.js"` - **proibido** em `packages/*`, falha em `pnpm doctor` e `vitest` gate.
- `src/core` e `src/domain` **nunca** importam de `packages/*`.

---

### 2. `package.json` publicado `behavior-os`

**Antes (v1.2.0):**

```json
{
  "name": "behavior-os",
  "version": "1.2.0",
  "type": "module",
  "bin": { "behavior-os": "dist/src/cli/index.js" },
  "files": ["dist/", "behavior-os/", ".opencode/", "dnas/", "src/", "README.md"],
  "scripts": { "build": "tsc -p tsconfig.json" }
}
```

Problemas: sem `exports` (superficie implicita = todo `src/`), sem `publishConfig`, sem `imports` para auto-referencia local.

**Depois (v1.3.0):**

```json
{
  "name": "behavior-os",
  "version": "1.3.0",
  "description": "Behavior OS - Workflow Operating System for governed multi-agent development",
  "type": "module",
  "bin": { "behavior-os": "dist/src/cli/index.js" },
  "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" },
  "exports": {
    ".": { "types": "./dist/src/index.d.ts", "default": "./dist/src/index.js" },
    "./domain": { "types": "./dist/src/domain/types.d.ts", "default": "./dist/src/domain/types.js" },
    "./ports": { "types": "./dist/src/domain/ports.d.ts", "default": "./dist/src/domain/ports.js" },
    "./workflow": { "types": "./dist/src/workflow/engine.d.ts", "default": "./dist/src/workflow/engine.js" }
  },
  "imports": {
    "#domain/*": "./src/domain/*",
    "behavior-os": "./dist/src/index.js",
    "behavior-os/domain": "./dist/src/domain/types.js",
    "behavior-os/ports": "./dist/src/domain/ports.js"
  },
  "files": ["dist/", "behavior-os/", ".opencode/", "dnas/", "README.md", "CHANGELOG.md", "AGENTS.md", "BOOTSTRAP.md"],
  "engines": { "node": ">=18" }
}
```

**Regras:**

- `name` e **`behavior-os`** (kebab, identificador npm) - `behaviorOS` e marca, nao nome de pacote. Validacao: `pnpm doctor` verifica `/^behavior-os$/`.
- `exports` e **unica superficie publica**. Qualquer `import "behavior-os/x"` nao listado falha em `typecheck` (NodeNext).
- `files` **nao** inclui `src/` bruto em `v1.3` final (apenas `dist/` compilado). Durante transicao `v1.3-proposal` mantem `src/` por compatibilidade, mas `packages/*` ja deve migrar para `behavior-os`.
- `imports` (`#domain/*`) permite `src/core` usar alias interno sem relativo, mas **nao** e usado por `packages/*` - estes usam `behavior-os`.
- `pnpm build` (`tsc -p tsconfig.json`) deve gerar `dist/` antes de `npm publish`; `prepublishOnly: "pnpm build"` recomendado.
- `tsconfig.json` ajustado para `NodeNext` com `rewriteRelativeImportExtensions` - imports de `behavior-os` permanecem sem extensao em types, com `.js` em runtime.

---

### 3. Contrato `Sdk Port` - sem `../../src`

```ts
// src/domain/ports.ts - sem dependencia fs/env/zod, apenas tipos abstratos
import type { Mission, Workflow, Evidence } from "./types.js";

// Port raiz - unica injecao que o SDK precisa
export interface SdkPorts {
  mission: MissionPort;
  workflow: WorkflowPort;
  evidence: EvidencePort;
  learning: LearningPort;
  governance: GovernancePort;
  kernel: KernelPort;
}

// Cada port e interface pura (hexagonal / ports & adapters)
export interface MissionPort {
  load(path: string): Mission;
  validate(mission: Mission): { allowed: boolean; policyId: string; reasons: string[] };
  execute(missionPath: string, workflowPath: string): Promise<Evidence>;
}

export interface WorkflowPort {
  load(path: string): Workflow;
  run(workflow: Workflow, mission: Mission): Promise<Evidence>;
  list(): Workflow[];
}

export interface EvidencePort {
  path(missionId: string): string;
  read(missionId: string): Evidence | null;
  write(evidence: Evidence): void;
  ledger(mission: Mission, workflow: Workflow): EvidenceLedgerPort;
}

export interface EvidenceLedgerPort {
  start(): Evidence;
  complete(extra-: Partial<Evidence>): Evidence;
  fail(reason: string): Evidence;
  readonly path: string;
}

export interface LearningPort {
  record(entry: LearningEntry): Promise<void>;
  detectPatterns(missionId: string): Promise<LearningPattern[]>;
}

export interface LearningEntry { missionId: string; signal: string; meta-: Record<string, unknown>; timestamp: string; }
export interface LearningPattern { id: string; signal: string; count: number; }

export interface GovernancePort {
  check(mission: Mission): { allowed: boolean; action: "block"|"pass"|"warn"; policyId: string; reasons: string[] };
}

export interface KernelPort {
  emit(event: KernelEvent): void;
  getEvents(missionId: string): KernelEvent[];
  clearEvents(missionId-: string): void;
}

export interface KernelEvent { type: string; missionId: string; timestamp: string; [k:string]: unknown; }

// Factory - src/core cria ports reais; packages/sdk recebe via injecao
export function createSdkPorts(overrides-: Partial<SdkPorts>): SdkPorts;
```

**Regras:**

- `src/domain/ports.ts` **nunca** importa `fs`, `process.env`, `zod`, `@opentelemetry/*` ou `behavior-os/runtime/*`. Apenas tipos.
- `src/core/*` **implementa** cada Port (`class MissionEngine implements MissionPort`). `packages/*` **consome** via `SdkPorts` injetado, nunca via `new MissionEngine()` direto nem `import "../../src/..."`.
- `createSdkPorts()` e factory em `src/index.ts` (barrel publico) que compoe implementacoes reais; SDK usa `createSdkPorts()` quando roda dentro do monorepo, e `InMemorySdkPorts` em testes.
- Quebra de regra (`grep -r "\.\./\.\./src" packages/`) - `vitest` falha + `doctor` falha (fail-closed).

---

### 4. Catalogo de Ports (v1.3.0)

| Port | Interface | Implementacao (`src/core` ou `packages`) | SDK expoe |
|------|-----------|------------------------------------------|-----------|
| `MissionPort` | `load/validate/execute` | `src/core/mission-engine.ts` | `sdk.createMission/startMission` |
| `WorkflowPort` | `load/run/list` | `src/workflow/engine.ts` | `sdk.runWorkflow` |
| `EvidencePort` | `path/read/write/ledger` | `src/core/evidence-ledger.ts` | `sdk.getEvidence` |
| `LearningPort` | `record/detectPatterns` | `src/core/learning.ts` | `sdk.recordLearning` |
| `GovernancePort` | `check` | `src/core/governance.ts` + `src/domain/policies.ts` | `sdk.checkGovernance` |
| `KernelPort` | `emit/getEvents/clearEvents` | `packages/kernel/events.ts` | `sdk.emit` (interno) |
| `VersioningPort` | ADR 006 | `packages/control-plane/versioning.ts` | `sdk.version` |
| `McpPort` | ADR 007 `McpMarketplace/Gateway` | `packages/mcp/*` | `sdk.tools` |
| `TracingPort` | ADR 005 `TracingProvider` | `packages/observability/*` | `sdk.tracing` |

`SdkPorts` agrega os 6 primeiros em `v1.3`; `Versioning/Mcp/Tracing` sao ports opcionais injetados se feature flag habilitada (ADR 006).

---

### 5. Adaptacao SDK - antes/depois

**Antes (v1.2.0 - violacao):**

```ts
// packages/sdk/index.ts
import { executeMission } from "../../src/core/mission-engine.js";
import { recordLearning } from "../../src/core/learning.js";

export class BehaviorOS {
  constructor(private opts: { dnaPath-: string } = {}) {}
  async createMission(mission: any) { return mission; }
  async startMission(missionId: string, workflowId = "development") {
    return executeMission(`behavior-os/missions/${missionId}.json`, `behavior-os/workflows/${workflowId}.json`);
  }
  async recordLearning(entry: any) { return recordLearning(entry); }
}
```

**Depois (v1.3.0 - contrato):**

```ts
// packages/sdk/index.ts - sem ../../src
import type { SdkPorts, Mission, Evidence } from "behavior-os/ports";
import { createSdkPorts } from "behavior-os";

export class BehaviorOS {
  constructor(private readonly ports: SdkPorts = createSdkPorts()) {}

  async createMission(mission: Mission): Promise<Mission> { return mission; }

  async startMission(missionId: string, workflowId = "development"): Promise<Evidence> {
    return this.ports.mission.execute(
      `behavior-os/missions/${missionId}.json`,
      `behavior-os/workflows/${workflowId}.json`
    );
  }

  async recordLearning(entry: { missionId: string; signal: string }): Promise<void> {
    return this.ports.learning.record({ ...entry, timestamp: new Date().toISOString() });
  }

  getEvidence(missionId: string): Evidence | null {
    return this.ports.evidence.read(missionId);
  }
}

// Barrel publico - src/index.ts (exportado via package.json ".")
export { createSdkPorts } from "./domain/ports.js";
export type { Mission, Workflow, Evidence } from "./domain/types.js";
export type { SdkPorts, MissionPort, EvidencePort } from "./domain/ports.js";
export { BehaviorOS } from "../packages/sdk/index.js"; // re-export opcional para consumo direto
```

**Migracao `packages/*` (exemplos):**

```ts
// packages/orchestrator/workflow-generator.ts - antes
import type { Workflow } from "../../src/domain/types.js";
// depois
import type { Workflow } from "behavior-os/domain";

// packages/kernel/context.ts - antes
import { graphifyStatus } from "../../src/adapters/graphify.js";
// depois
import { graphifyStatus } from "behavior-os";
// ou, se exposto como port:
// import type { GraphifyPort } from "behavior-os/ports"; constructor(private graphify: GraphifyPort) {}
```

**Regra de migracao:** `pnpm exec grep -rn "\.\./\.\./src" packages/` deve retornar **0** linhas apos `v1.3.0`. Cada ocorrencia e migrada para `behavior-os` ou `behavior-os/domain` ou `behavior-os/ports`.

---

### 6. Evidencia observavel `behavior-os/runtime/sdk.json` + `evidence.sdk`

**Extensao em `src/domain/types.ts`:**

```ts
export interface Evidence {
  // ...existentes (missionId, workflowId, status, stages, governance, graphify, langgraph, traces, mcp, version)
  sdk-: {
    packageName: string; // "behavior-os"
    version: string;     // Semver do pacote no momento da missao
    ports: string[];     // lista de ports injetados (ex: ["mission","evidence","learning"])
    violatedImports: string[]; // deve ser [] - grep ../../src
  };
}
```

**Artefato `behavior-os/runtime/sdk.json` (Regra de Ouro):**

```json
{
  "packageName": "behavior-os",
  "version": "1.3.0",
  "exports": {
    ".": "./dist/src/index.js",
    "./domain": "./dist/src/domain/types.js",
    "./ports": "./dist/src/domain/ports.js"
  },
  "ports": ["mission", "workflow", "evidence", "learning", "governance", "kernel"],
  "violatedImports": [],
  "updatedAt": "2026-09-02T15:31:53.793Z",
  "validation": { "valid": true, "errors": [] }
}
```

**Regra de Ouro (evidencia):**

- `SDK Port` funcional - `behavior-os/runtime/sdk.json` existe **e** `JSON.parse` valido **e** `packageName === "behavior-os"` **e** `violatedImports.length === 0` **e** `ports.length >= 4` **e** `validation.valid === true`.
- `evidence-ledger.ts` apos `complete()`: compoe `evidence.sdk` a partir de `SdkPorts` + `read package.json - name/version/exports` + `grep` virtual (`violatedImports`).
- `pnpm doctor` verifica: `existsSync(sdk.json)` + `packageName` + `violatedImports.length === 0` + `exports["."]` + `exports["./ports"]` existem.
- `pnpm demo` deve gerar `behavior-os/runtime/sdk.json` com `ports` e `evidence.sdk` com `violatedImports: []`.

---

### 7. Integracao com Bootstrap e Gates

```
pnpm install - pnpm typecheck - pnpm test - pnpm demo - pnpm doctor
                              -> vitest: SdkPorts InMemory + violatedImports === 0 + BehaviorOS via behavior-os
                                                        -> doctor: package.json name + exports + sdk.json valid
```

- `vitest` deve cobrir: `BehaviorOS` via `InMemorySdkPorts` (sem `../../src`), `createSdkPorts()` retorna todos os ports, `grep ../../src` em `packages/` retorna 0, `package.json` `name === "behavior-os"` e `exports["."]` valido.
- `pnpm demo` deve gerar `behavior-os/runtime/demo.json` com `sdk.packageName === "behavior-os"` e `behavior-os/runtime/sdk.json` com `violatedImports: []`.
- `behavior-os/runtime/sdk.json` deve existir apos `demo` (Regra de Ouro: `Configuracao nao e integracao`).

---

## Consequencias

**Positivas:**

- SDK publicavel no npm como `behavior-os` sem path relativo quebrado - `npx behavior-os init` e `import "behavior-os"` funcionam em host externo.
- `src/core` desacoplado de `packages/*`; testes usam `InMemorySdkPorts` sem I/O nem build.
- `exports` fecha superficie publica - internos de `src/` nao vazam para consumidor.
- `SdkPorts` centraliza injecao: `mission-engine`, `evidence-ledger`, `learning` governaveis e auditaveis via `Gateway`/`Governance` futuros.
- `violatedImports` + `sdk.json` fecham Regra de Ouro: SDK e evidencia, nao declaracao.

**Negativas / Mitigacoes:**

- Duplo artefato (`evidence.sdk` + `sdk.json`) - mitigado por `evidence.sdk` ser snapshot pontual e `sdk.json` ser estado global (link, nao divergencia).
- `exports` NodeNext exige `dist/` pre-build para `vitest` local - mitigado por `tsx` resolver `behavior-os` via `imports` + `tsconfig paths` em dev/test, e `pnpm build` em `prepublishOnly` + CI.
- Migracao `../../src` - `behavior-os` toca 14 arquivos - mitigado por codemod `sed` + gate `grep` fail-closed.
- `src/index.ts` barrel adiciona indirection - mitigado por re-export tipado e `createSdkPorts()` factory unica.

**Gates v1.3.0 (contrato, nao exige implementacao completa alem de tipos + package.json):**

- [ ] `src/domain/ports.ts` com `SdkPorts`, `MissionPort`, `WorkflowPort`, `EvidencePort`, `LearningPort`, `GovernancePort`, `KernelPort`
- [ ] `src/index.ts` barrel publico (`createSdkPorts`, `BehaviorOS` re-export, `Mission/Workflow/Evidence` types)
- [ ] `package.json` com `name: "behavior-os"`, `exports { ".","./domain","./ports","./workflow" }`, `imports` alias, `publishConfig`
- [ ] `packages/sdk/index.ts` reescrito sem `../../src` (usa `behavior-os` + `behavior-os/ports`)
- [ ] `packages/*` (orchestrator, dna, kernel, knowledge, adapters) migrados para `behavior-os/domain`
- [ ] `src/domain/types.ts` estendido com `Evidence.sdk`
- [ ] `src/core/evidence-ledger.ts` persiste `sdk` + escreve `behavior-os/runtime/sdk.json`
- [ ] `behavior-os/runtime/sdk.json` gerado em `demo` com `violatedImports: []` + `packageName === "behavior-os"`
- [ ] `vitest` - `SdkPorts InMemory`, `BehaviorOS via behavior-os`, `grep ../../src === 0`, `package.json exports`
- [ ] `pnpm doctor` verifica `sdk.json` + `package.json` `name` + `exports`

## Alternativas Consideradas

1. **Manter `../../src` em `packages/*`** - rejeitado: quebra publicacao npm, acopla ao caminho fisico, impede host sovereignty.
2. **Monorepo sem `exports`, importar via caminho relativo `src/`** - rejeitado: sem `exports` nao ha superficie publica; `src/` exposto vaza internos e nao e gateavel.
3. **SDK como pacote separado `@behavior-os/sdk` com name diferente** - rejeitado: duplica publicacao, perde `behavior-os` como nome canonico ja usado em `npx behavior-os`; SDK e fachada do OS, nao pacote isolado.
4. **Re-exportar tudo em `packages/sdk` sem `src/domain/ports.ts`** - rejeitado: sem `Ports` nao ha inversao de dependencia; `src/core` continuaria importado direto, sem `Governance` intercept.
5. **Usar `pnpm-workspace` alias `workspace:behavior-os` sem `exports`** - rejeitado: funciona local mas nao define contrato publicado; `exports` e exigido pelo Node resolver em npm.

## Referencias

- `docs/ARCHITECTURE.md` v1.1 - Fronteiras Kernel/Mission Engine/Evidence/OpenCode/Graphify/LangGraph
- `src/domain/types.ts` - `Mission` + `Workflow` + `Evidence`
- `src/domain/ports.ts` (novo) - `SdkPorts` + `MissionPort` + `EvidencePort`
- `src/core/mission-engine.ts` - `loadMission/loadWorkflow/validateMission/executeMission`
- `src/core/evidence-ledger.ts` - `evidencePath()` + `write()` + `Evidence.sdk`
- `src/core/learning.ts` - `recordLearning`
- `src/index.ts` (novo barrel) - `createSdkPorts()` + re-exports publicos
- `packages/sdk/index.ts` (antes: `../../src/core/*`) - evolui para `behavior-os` + `behavior-os/ports`
- `packages/orchestrator/workflow-generator.ts`, `packages/kernel/context.ts`, `packages/dna/evolution.ts` - exemplos de migracao `../../src` - `behavior-os/domain`
- `package.json` - `name:"behavior-os"`, `exports`, `imports`, `publishConfig`, `files`
- `tsconfig.json` - `NodeNext` + `rewriteRelativeImportExtensions` + `types: ["node"]`
- `behavior-os/runtime/sdk.json` (novo) - snapshot de `SdkPorts` + `violatedImports` (evidencia observavel)
- `behavior-os/runtime/<mission>.json` - `evidence.sdk` snapshot por missao
- ADR 001 (Core boundaries), ADR 002 (Evidence-first), ADR 003 (Bootstrap), ADR 005 (OTel), ADR 006 (Control Plane), ADR 007 (McpMarketplace)

> **Nota:** Este ADR e **especificacao**. Nao requer implementacao de codigo em `v1.3.0-proposal` alem dos tipos de contrato (`src/domain/ports.ts` + `src/index.ts` barrel + `package.json#exports`); gates acima sao criterios de aceite quando os Ports forem implementados. A violacao `../../src` e fail-closed em `doctor`/`vitest`.
