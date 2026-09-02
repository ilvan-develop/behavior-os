# ADR 007 — MCP Marketplace (Tool Registry + Gateway + Evidence)

**Status:** Proposed | **Versão:** behaviorOS v1.3.0 | **Data:** 2026-09-02 | **Decide:** `McpMarketplace` com `Tool` zod schema + `Gateway` + `.opencode/tools/*.ts` + `behavior-os/runtime/mcp.json`
**Relacionados:** ADR 001 (Core boundaries), ADR 002 (Evidence-first), ADR 003 (Bootstrap), ARCHITECTURE v1.1 (Kernel/Mission Engine/Evidence), `src/domain` vs `src/core` vs `adapters`

---

## Contexto

`v1.2.0` entregou `.opencode/tools/behaviorOS.ts` como tool isolada via `tool()` do `@opencode-ai/plugin`, sem catálogo, sem validação de schema e sem evidência gateável. O princípio `Mission → Workflow Engine → Agents → Skills → Governance → Evidence` exige que **tools sejam contratos auditáveis** com evidência observável, não arquivos soltos.

Problemas sem ADR:

- Sem `Tool` zod schema não há validação de `args` antes de `execute` (fail-open: tool aceita payload inválido).
- Sem `McpMarketplace` não há registry único: cada agente importa `.opencode/tools/*` direto (quebra ADR 001, acopla `src/core` a `opencode`).
- Sem `Gateway` não há fronteira para `governance` (policy-as-code) interceptar chamadas `tool.execute` nem para `evidence` registrar invocações.
- Sem `behavior-os/runtime/mcp.json` viola Regra de Ouro (`Configuração não é integração`): declarar `opencode.json → mcp.graphify` não prova que marketplace está funcional.
- `.opencode/tools/*.ts` hoje é convenção implícita (`filename vira tool`) sem contrato que mapeie `tool.name` ↔ `filename` ↔ `registry id`.

Objetivo `v1.3.0 (LEARN-07)`: definir contrato **sem implementar código além do esqueleto de tipos**, que permita registrar tools com zod, rotear via Gateway com governance, manter `src/core` puro e gerar `behavior-os/runtime/mcp.json` observável por `pnpm doctor`/`audit`.

---

## Decisão

### 1. Fronteiras (respeito a `src/domain` vs `src/core` vs `adapters`)

```
src/domain/mcp.ts                 → contratos (McpMarketplace, Tool, ToolSchema, Gateway, McpEvidence)
src/domain/types.ts               → estende Evidence com `mcp`
src/core/mission-engine.ts        → orquestra via McpMarketplace/Gateway injetados (não importa .opencode/tools/* nem zod direto)
packages/mcp/*                    → adapters (único lugar que importa zod + fs + @opencode-ai/plugin/tool)
src/adapters/mcp/*                → alternativa física se `packages/*` não for usado (escolher 1; preferir packages/mcp)
.opencode/tools/*.ts              → superfície nativa OpenCode (cada arquivo exporta default tool({ ... }))
behavior-os/runtime/mcp.json      → evidência observável — snapshot do registry (Regra de Ouro)
behavior-os/runtime/<mission>.json → evidence.mcp (snapshot por missão)
```

`Kernel` e `src/core` nunca importam `zod`, `fs` ou `@opencode-ai/plugin` direto. `evidence-ledger.ts` compõe `Evidence.mcp` a partir do Gateway/Marketplace.

---

### 2. Contrato `Tool` — zod schema (única fonte de validação)

```ts
// src/domain/mcp.ts — sem dependência zod, apenas tipos abstratos + re-export do schema
// O adapter packages/mcp/tool.ts é o único que importa zod e cria o schema runtime.

import { z } from "zod";

// Shape declarativo serializável (usado no registry + mcp.json)
export interface ToolSchemaDef {
  name: string;        // kebab-case, único no marketplace, mapeia para .opencode/tools/<name>.ts
  description: string; // 10..200 chars, usado por LLM para seleção
  args: z.ZodObject<z.ZodRawShape>;    // validação de entrada (fail-closed se inválido)
  output?: z.ZodTypeAny;               // validação de saída (opcional, recomendado)
}

// Contrato runtime da tool
export interface Tool<TArgs = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly schema: ToolSchemaDef;
  /** Valida args via zod antes de executar; lança ZodError se inválido (fail-closed) */
  validate(args: unknown): TArgs;
  /** Execução pura; Gateway envolve com governance + tracing + evidence */
  execute(args: TArgs, ctx: ToolContext): Promise<TOutput>;
}

export interface ToolContext {
  missionId: string;
  workflowId: string;
  stageId: string;
  traceId?: string;
  spanId?: string;
  signal?: AbortSignal;
}

// Definição zod canônica — exemplo behaviorOS tool migrada para contrato
export const ToolArgsSchema = z.object({
  action: z.enum(["status", "run-demo", "doctor", "evidence"]).describe("ação do control plane"),
  missionId: z.string().regex(/^[a-zA-Z0-9._-]+$/).optional().describe("mission id para evidence lookup"),
});

export const BehaviorOsToolDef: ToolSchemaDef = {
  name: "behaviorOS",
  description: "behaviorOS control plane — run mission, check evidence, report status",
  args: z.object({
    action: z.enum(["status", "run-demo", "doctor", "evidence"]),
    missionId: z.string().regex(/^[a-zA-Z0-9._-]+$/).optional(),
  }),
  output: z.string(),
};

// Helper de registro — usado apenas em adapters/packages
export function defineTool<TArgs, TOutput>(def: ToolSchemaDef & {
  execute: (args: TArgs, ctx: ToolContext) => Promise<TOutput>;
}): Tool<TArgs, TOutput>;
```

**Regras:**

- `name` **único** no marketplace; colisão → `register()` lança `Error("Tool already registered: <name>")` (fail-closed).
- `name` deve corresponder a `kebab-case` de `.opencode/tools/<name>.ts` (ex: `behaviorOS` → `behaviorOS.ts` ou `behavior-os.ts` — normalizado via `toKebab()` no adapter). Divergência é `warn` em `doctor`, não `block` em `v1.3`.
- `args` **sempre** `z.ZodObject` (nunca `z.any()` nem `z.unknown()` sem refinamento). Tool sem schema é inválida.
- `validate()` é chamada **antes** de `execute()` tanto por `Gateway.invoke()` quanto por registro em `McpMarketplace`; `ZodError` vira `evidence.mcp.invocations[].error = "validation_failed"` + `status: FAILED`.
- `description` obrigatória para seleção por LLM; tool sem descrição falha em `doctor`.

---

### 3. Contrato `McpMarketplace` — registry

```ts
// src/domain/mcp.ts (continuação)

export interface ToolRegistration {
  tool: Tool;
  source: "opencode-tool" | "mcp-server" | "builtin";
  file?: string;        // ex: ".opencode/tools/behaviorOS.ts" se source === "opencode-tool"
  serverId?: string;    // ex: "graphify" se source === "mcp-server" (opencode.json → mcp[serverId])
  registeredAt: string; // ISO-8601
}

export interface MarketplaceSnapshot {
  version: string; // Semver do marketplace (espelha behavior-os@version)
  updatedAt: string;
  tools: Array<{
    name: string;
    description: string;
    source: ToolRegistration["source"];
    file?: string;
    serverId?: string;
    argsShape: string[]; // Object.keys(tool.schema.args.shape) — auditável sem zod
  }>;
  servers: Array<{
    id: string;
    type: "local" | "remote";
    command?: string[];
    url?: string;
    enabled: boolean;
  }>;
}

export interface McpMarketplace {
  /** Registra tool; falha se name duplicado ou schema inválido */
  register(tool: Tool, meta: Omit<ToolRegistration, "tool" | "registeredAt">): void;
  /** Remove tool (apenas em testes / hot-reload) */
  unregister(name: string): boolean;
  /** Lista tools registradas (somente leitura) */
  list(): ToolRegistration[];
  /** Busca por name; undefined se não existe (não lança) */
  get(name: string): ToolRegistration | undefined;
  /** Valida todas as tools (zod + name uniqueness + file exists se opencode-tool) */
  validate(): { valid: boolean; errors: string[] };
  /** Snapshot serializável para mcp.json / evidence */
  snapshot(): MarketplaceSnapshot;
  /** Carrega .opencode/tools/*.ts + opencode.json mcp → registra automaticamente (adapter) */
  loadFromDisk?(rootDir: string): Promise<{ loaded: number; errors: string[] }>;
}
```

**Regras:**

- Marketplace é **singleton por processo** (`packages/mcp/marketplace.ts → globalMarketplace: McpMarketplace`). `src/core` recebe via injeção, nunca via import global direto.
- `loadFromDisk()` é **apenas** no adapter (`packages/mcp/loader.ts`): faz `glob .opencode/tools/*.ts` + `read opencode.json → mcp` e chama `register()` para cada tool. `src/core` nunca faz I/O.
- `validate()` verifica: `name` regex `^[a-z][a-z0-9-]*$` (kebab), `description` 10..200 chars, `args` é `ZodObject`, `file` existe se `source === "opencode-tool"` (via `existsSync` no adapter).
- `snapshot()` é a base para `behavior-os/runtime/mcp.json` — sem zod runtime, apenas `argsShape` (lista de keys) para auditoria.

---

### 4. Contrato `Gateway` — fronteira governance + evidence + tracing

```ts
// src/domain/mcp.ts (continuação)

export interface GatewayInvokeOptions {
  tool: string;           // name no marketplace
  args: unknown;          // será validado via Tool.validate()
  context: ToolContext;
}

export interface GatewayInvocation {
  id: string;             // ulid / nanoid — correlação com trace spanId
  tool: string;
  args: unknown;
  context: ToolContext;
  startedAt: string;
  finishedAt?: string;
  status: "success" | "failed" | "blocked";
  result?: unknown;
  error?: string;
  blockedBy?: string;     // policyId se governance bloqueou
  traceId?: string;
  spanId?: string;
}

export interface Gateway {
  readonly marketplace: McpMarketplace;
  /** Invoca tool via marketplace com validação zod + governance + evidence */
  invoke<TOutput = unknown>(opts: GatewayInvokeOptions): Promise<TOutput>;
  /** Lista invocações da missão (para evidence) */
  getInvocations(missionId: string): GatewayInvocation[];
  /** Limpa invocações (apenas testes) */
  clearInvocations(missionId?: string): void;
}
```

**Fluxo `Gateway.invoke()` (ordem fixa):**

```
1. marketplace.get(tool) → ToolRegistration | undefined
   └─ se undefined → throw Error("Tool not found: <name>") → invocation status=failed

2. governance.check({ tool, args, context }) → GovernanceVerdict
   └─ se verdict.action === "block" → invocation status=blocked, blockedBy=policyId, não chama execute

3. tool.validate(args) → TArgs
   └─ se ZodError → status=failed, error="validation_failed: <issues>"

4. tracing.startSpan("tool:<name>", { parentSpan: stageSpan })  (se TracingProvider injetado)
   └─ span.setAttribute("tool.name", name)

5. tool.execute(validatedArgs, context) → TOutput
   └─ se throw → status=failed, error=message, span.setStatus("error")

6. tool.schema.output?.parse(result)  (se output schema definido)
   └─ se ZodError → status=failed, error="output_validation_failed"

7. span.setStatus("ok") + span.end() → invocation status=success, result

8. evidence-ledger append: GatewayInvocation → behavior-os/runtime/mcp.json + evidence.mcp
```

**Regras:**

- Gateway é **única via** para `src/core` chamar tools. Chamar `tool.execute()` direto fora do Gateway é proibido (quebra governance/audit).
- `ToolContext` sempre preenchido por `mission-engine` a partir de `Mission` + `TraceContext` (se OTel habilitado — ADR 005).
- `getInvocations(missionId)` alimenta `Evidence.mcp.invocations` e `behavior-os/runtime/mcp.json`.

---

### 5. `.opencode/tools/*.ts` — superfície nativa OpenCode

**Convenção (nativa OpenCode, não inventar):**

- Cada arquivo em `.opencode/tools/*.ts` exporta `default tool({ description, args, execute })` onde `tool` vem de `@opencode-ai/plugin` e `args` usa `tool.schema.*` (que é zod por baixo).
- Filename vira `tool.name` (normalizado kebab): `behaviorOS.ts` → `behaviorOS` (preservado) ou `my-tool.ts` → `my-tool`.
- Loader (`packages/mcp/loader.ts`) faz bridge: lê arquivo, extrai `def` e chama `marketplace.register(adaptedTool, { source: "opencode-tool", file })`.

```ts
// .opencode/tools/behaviorOS.ts — exemplo conforme contrato (adapter faz bridge para Tool)
import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "behaviorOS control plane — run mission, check evidence, report status",
  args: {
    action: tool.schema.string().describe("action: status | run-demo | doctor | evidence"),
    missionId: tool.schema.string().optional().describe("mission id for evidence lookup"),
  },
  async execute(args) {
    // ...igual ao existente — loader envolve com validate + Gateway
  },
});

// Loader interno (packages/mcp/loader.ts) adapta para Tool:
// const def: ToolSchemaDef = { name: "behaviorOS", description, args: z.object({ action: z.enum([...]), missionId: z.string().optional() }) }
// marketplace.register(defineTool({ ...def, execute: wrappedExecute }), { source: "opencode-tool", file: ".opencode/tools/behaviorOS.ts" })
```

**Regras:**

- Tools em `.opencode/tools/` continuam funcionando via OpenCode nativo mesmo sem Marketplace (compatibilidade). Marketplace apenas **espelha** o catálogo para governance/evidence.
- Nova tool criada em `.opencode/tools/*.ts` aparece em `marketplace.snapshot().tools` após `loadFromDisk()` ou `pnpm demo` (que chama loader).
- `opencode.json → mcp` (ex: `graphify: { type:"local", command:["python","-m","graphify.serve","graphify-out/graph.json"] }`) é mapeado para `MarketplaceSnapshot.servers` + tools com `source: "mcp-server"`.

---

### 6. Evidência observável `behavior-os/runtime/mcp.json` + `evidence.mcp`

**Extensão em `src/domain/types.ts`:**

```ts
export interface Evidence {
  // ...existentes (missionId, workflowId, status, stages, governance, ...)
  mcp?: {
    snapshotFile: string; // "behavior-os/runtime/mcp.json"
    exists: boolean;
    toolCount: number;
    serverCount: number;
    invocations: GatewayInvocation[]; // snapshot das invocações da missão
    valid: boolean; // marketplace.validate().valid no momento da missão
  };
}
```

**Artefato `behavior-os/runtime/mcp.json` (Regra de Ouro):**

```json
{
  "version": "1.3.0",
  "updatedAt": "2026-09-02T15:31:53.793Z",
  "tools": [
    { "name": "behaviorOS", "description": "behaviorOS control plane — run mission, check evidence, report status", "source": "opencode-tool", "file": ".opencode/tools/behaviorOS.ts", "argsShape": ["action", "missionId"] }
  ],
  "servers": [
    { "id": "graphify", "type": "local", "command": ["python", "-m", "graphify.serve", "graphify-out/graph.json"], "enabled": true }
  ],
  "validation": { "valid": true, "errors": [] },
  "invocations": [
    { "id": "01J8...", "tool": "behaviorOS", "args": { "action": "status" }, "context": { "missionId": "demo", "workflowId": "development", "stageId": "discover" }, "startedAt": "2026-09-02T15:31:53.793Z", "finishedAt": "2026-09-02T15:31:53.794Z", "status": "success", "result": "behaviorOS status: check behavior-os/runtime/..." }
  ]
}
```

**Regra de Ouro (evidência):**

- `McpMarketplace` funcional ⇔ `behavior-os/runtime/mcp.json` existe **e** `JSON.parse` válido **e** `tools.length >= 1` **e** `validation.valid === true` **e** `tools[].argsShape` não vazio.
- `evidence-ledger.ts` após `complete()`: chama `marketplace.snapshot()` + `gateway.getInvocations(missionId)` e persiste `evidence.mcp` + escreve `behavior-os/runtime/mcp.json` (via `packages/mcp/store.ts`).
- `pnpm doctor` verifica: `existsSync(mcp.json)` + `JSON.parse` + `tools.length >=1` + `validation.valid` + `evidence.mcp.exists` se missão recente.
- `pnpm demo` deve gerar `behavior-os/runtime/mcp.json` com `tools: [{ name:"behaviorOS", source:"opencode-tool" }]` e `servers` espelhando `opencode.json → mcp`.

---

### 7. Integração com Bootstrap e Gates

```
pnpm install → pnpm typecheck → pnpm test → pnpm demo → pnpm doctor
                              ↘ vitest: Tool zod validation + Marketplace register/uniqueness + Gateway block/validate + mcp.json snapshot
                                                        ↘ doctor: mcp.json exists + valid + tools.length >=1
```

- `vitest` deve cobrir: `Tool.validate` aceita/rejeita `args`, `McpMarketplace.register` lança em duplicata, `Gateway.invoke` bloqueia via governance mock, `snapshot()` reflete `.opencode/tools/*.ts` + `opencode.json mcp`.
- `pnpm demo` deve gerar `behavior-os/runtime/demo.json` com `mcp.toolCount >=1` e `behavior-os/runtime/mcp.json` com `invocations`.
- `behavior-os/runtime/mcp.json` deve existir após `demo` (Regra de Ouro: `Configuração não é integração`).

---

## Consequências

**Positivas:**

- `Tool` com zod garante fail-closed: payload inválido nunca chega a `execute` (governance + evidência).
- `McpMarketplace` centraliza registry: `src/core` desacoplado de `.opencode/tools/*` e de `opencode.json`; testes usam `InMemoryMarketplace` sem I/O.
- `Gateway` fecha fronteira governance: toda invocação passa por `policy-as-code` (ADR 004) e gera `GatewayInvocation` auditável.
- `.opencode/tools/*.ts` preservado como superfície nativa; Marketplace apenas espelha (compatibilidade OpenCode).
- `behavior-os/runtime/mcp.json` + `evidence.mcp` fecham Regra de Ouro: marketplace é evidência, não declaração.
- `MarketplaceSnapshot.servers` torna `opencode.json → mcp` observável e gateável por `doctor`.

**Negativas / Mitigações:**

- Duplo artefato (`evidence.mcp` + `mcp.json`) → mitigado por `evidence.mcp.snapshotFile` apontar para `mcp.json` (link, não duplicação divergente).
- `loadFromDisk()` com `glob + import` adiciona I/O em startup → mitigado por cache em `packages/mcp/loader.ts` com `mtime` e `marketplace.validate()` lazy.
- `zod` em `packages/mcp` adiciona dependência → mitigado por `src/domain/mcp.ts` não importar `zod` direto; apenas adapter depende, `src/core` usa tipos abstratos.
- Bridge `.opencode/tools/*.ts` (`tool.schema.*` → `z.ZodObject`) requer adaptação → mitigado por `packages/mcp/loader.ts` normalizar `tool.schema` para `zod` (mapeamento 1:1, `tool.schema` já é zod).

**Gates v1.3.0 (contrato, não exige implementação completa além de tipos):**

- [ ] `src/domain/mcp.ts` com `Tool`, `ToolSchemaDef`, `McpMarketplace`, `Gateway`, `MarketplaceSnapshot`, `GatewayInvocation`
- [ ] `packages/mcp/marketplace.ts` → `InMemoryMarketplace implements McpMarketplace` (register/list/validate/snapshot)
- [ ] `packages/mcp/gateway.ts` → `Gateway` com validate → governance → execute → output validate
- [ ] `packages/mcp/loader.ts` → `loadFromDisk(".opencode/tools")` + `opencode.json mcp` → `marketplace`
- [ ] `packages/mcp/store.ts` → `writeMcpSnapshot(snapshot, invocations)` → `behavior-os/runtime/mcp.json`
- [ ] `src/domain/types.ts` estendido com `Evidence.mcp`
- [ ] `src/core/evidence-ledger.ts` persiste `mcp` + `GatewayInvocation[]`
- [ ] `behavior-os/runtime/mcp.json` gerado em `demo` com `tools.length >=1` + `validation.valid`
- [ ] `vitest` → `Tool zod valid/invalid`, `Marketplace uniqueness`, `Gateway governance block`, `snapshot servers`
- [ ] `pnpm doctor` verifica `mcp.json` + `evidence.mcp` (doctor estendido)

## Alternativas Consideradas

1. **Tools diretas sem Marketplace (import `.opencode/tools/*` em `src/core`)** — rejeitado: quebra ADR 001, acopla core a opencode, impede governance intercept e testes com `InMemoryMarketplace`.
2. **Schema via `JSON Schema` em vez de `zod`** — rejeitado: `tool.schema` do `@opencode-ai/plugin` já é zod; duplicar em JSON Schema exigiria conversão e perderia inferência `z.infer`.
3. **Sem `Gateway`, chamar `tool.execute()` direto** — rejeitado: sem fronteira não há `governance` (ADR 004) nem `tracing` (ADR 005) nem `evidence` por invocação.
4. **Sem `behavior-os/runtime/mcp.json`, só `evidence.mcp`** — rejeitado: viola Regra de Ouro; estado global do marketplace precisa ser observável fora de `runtime/<mission>.json` para `doctor` gatear sem missão.
5. **Registry em `opencode.json` apenas (sem `.opencode/tools/*.ts`)** — rejeitado: OpenCode nativo exige `filename vira tool` em `.opencode/tools/*.ts`; remover quebraria compatibilidade com `npx opencode`.

## Referências

- `docs/ARCHITECTURE.md` v1.1 — Fronteiras Kernel/Mission Engine/Evidence/OpenCode/Graphify/LangGraph
- `src/domain/types.ts` → `Evidence` + `Workflow` + `Mission`
- `src/core/evidence-ledger.ts` → `evidencePath()` + `write()`
- `src/domain/policies.ts` → `GovernanceVerdict` + `policy-as-code` (ADR 004)
- `src/domain/tracing.ts` → `TracingProvider` + `TraceContext` (ADR 005)
- `.opencode/tools/behaviorOS.ts` (antes: `tool({ description, args, execute })` isolado) → evolui para `Tool` com zod + Gateway
- `opencode.json` → `mcp: { graphify: { type:"local", command:["python","-m","graphify.serve","graphify-out/graph.json"] } }`
- `behavior-os/runtime/mcp.json` (novo) → snapshot do marketplace + invocações (evidência observável)
- `behavior-os/runtime/<mission>.json` → `evidence.mcp` snapshot por missão
- `@opencode-ai/plugin` → `tool()` + `tool.schema.*` (zod) — superfície nativa OpenCode
- `zod` ^3.23 — `z.object`, `z.enum`, `z.string`, `ZodError` — validação fail-closed
- ADR 001 (Core boundaries), ADR 002 (Evidence-first), ADR 003 (Bootstrap), ADR 004 (Policy-as-code), ADR 005 (OTel), ADR 006 (Control Plane)

> **Nota:** Este ADR é **especificação**. Não requer implementação de código em `v1.3.0-proposal` além dos tipos de contrato; gates acima são critérios de aceite quando o Marketplace for implementado.
