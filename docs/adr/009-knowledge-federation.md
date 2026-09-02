# ADR 009 — Knowledge Federation (Federation merge + provenance + graphify-out/federated.json)

**Status:** Proposed | **Versão:** behaviorOS v1.3.0 | **Data:** 2026-09-02 | **Decide:** `Knowledge Federation` com `merge` deduplicado por `id` + `provenance` por nó/aresta + `graphify-out/federated.json` como única evidência observável + `evidence.federation`
**Relacionados:** ADR 001 (Core boundaries), ADR 002 (Evidence-first), ADR 003 (Bootstrap), ARCHITECTURE v1.1 (Kernel/Mission Engine/Evidence), `src/domain` vs `src/core` vs `adapters`, Graphify (graphify-out/graph.json, MCP)

---

## Contexto

`v1.2.0` entregou `packages/knowledge/federation.ts` como stub ad-hoc:

```ts
// packages/knowledge/federation.ts — STUB v1.2.0
import { graphifyStatus } from "../../src/adapters/graphify.js";
export function federateKnowledge() {
  const g = graphifyStatus();
  return { local: g, global: g, federated: true, nodes: g.nodeCount };
}
```

Problemas sem ADR:

- **`local === global` sem merge.** `federateKnowledge()` retorna o mesmo `GraphifyStatus` para `local` e `global`; não há leitura de dois grafos nem estratégia de união. `nodes` é contador, não grafo — impossível auditar quantos nós vieram de cada fonte ou se houve deduplicação.
- **Sem `provenance` não há rastreabilidade.** `graphify-out/graph.json` atual já carrega `source_file`, `source_location`, `_origin: "ast"` por nó, mas `federation.ts` descarta tudo e cria objeto `{ federated: true }` sem `sourceId`, `hash`, `mtime` ou `tenant`. Quebra `Evidence` auditável: não há como responder "este nó veio do host `my-saas/` ou do cache global?".
- **Sem `graphify-out/federated.json` viola Regra de Ouro (`Configuração não é integração`).** Declarar `federated: true` em memória não prova federação funcional; `graphify-out/graph.json` existe (207 nós `fresh`), mas `federated.json` não existe — `pnpm doctor` não tem artefato para gatear e `evidence` não registra federação.
- **Quebra ADR 001.** `packages/knowledge/federation.ts` importa `../../src/adapters/graphify.js` direto (mesmo problema de `../../src` de ADR 008). `src/core` e `src/domain` não têm contrato `Federation` injetável; testes não podem usar `InMemoryFederation` sem I/O.
- **Sem contrato de `merge` não há determinismo.** Dois grafos com `id` colidido (`src_domain_types_evidence`) precisam de regra — `local wins`, `global wins` ou `conflict`? Stub escolhe por acidente (retorna `local`). Falta `dedup`, `conflictCount`, `edge merge` e `provenance` por aresta.
- **Soberania e evidência divergem.** Host (`my-saas/`) gera `graphify-out/graph.json` local (207 nós do projeto); comportamento global (ex: `graphify-out/global.json` ou cache `examples/my-sass/graphify-out/graph.json`) não pode sobrescrever local silenciosamente. Sem `federated.json` versionado por `sources[].hash`, `audit` não detecta divergência entre execuções.

Objetivo `v1.3.0 (LEARN-09)`: definir contrato **sem implementar código além do esqueleto de tipos + `federated.json`**, que permita unir `graphify-out/graph.json` (local) + fontes globais opcionais via `merge` determinístico, preservar `provenance` por nó/aresta, manter `src/core` puro e gerar `graphify-out/federated.json` observável por `pnpm doctor`/`audit` + `evidence.federation`.

---

## Decisão

### 1. Fronteiras (respeito a `src/domain` vs `src/core` vs `adapters`)

```
src/domain/federation.ts            ? contratos (Federation, FederatedGraph, Provenance, MergeStrategy, FederationEvidence)
src/domain/types.ts                 ? estende Evidence com `federation`
src/core/mission-engine.ts          ? orquestra via Federation injetado (não lê graphify-out/* nem fs direto)
src/core/evidence-ledger.ts         ? compõe Evidence.federation a partir do Federation
packages/knowledge/federation.ts    ? adapter (único lugar que lê graphify-out/graph.json + graphify-out/global.json + fs/hash)
src/adapters/graphify.ts            ? permanece knowledge layer local (graphifyStatus, graphifyQuery); não conhece federação
graphify-out/graph.json             ? fonte local obrigatória (Regra de Ouro existente)
graphify-out/federated.json         ? artefato federado observável (Regra de Ouro nova — LEARN-09)
behavior-os/runtime/<mission>.json  ? evidence.federation (snapshot por missão)
```

`Kernel` e `src/core` nunca importam `fs`, `crypto`, `graphify-out/*` direto. `evidence-ledger.ts` compõe `Evidence.federation` a partir do `Federation.snapshot()`.

---

### 2. Contrato `FederatedGraph` + `Provenance`

```ts
// src/domain/federation.ts — sem dependência fs/zod, apenas tipos abstratos

export type SourceId = "local" | "global" | string; // string permite tenant workspace::project

export interface GraphProvenance {
  source: SourceId;           // "local" (graphify-out/graph.json) | "global" (global cache) | "workspace::project"
  path: string;               // caminho relativo normalizado (ex: "graphify-out/graph.json")
  hash: string;               // sha256 do arquivo fonte no momento do merge (primeiros 16 hex auditáveis)
  mtime: string;              // ISO-8601 do stat.mtime do arquivo fonte
  freshness: "fresh" | "stale" | "missing";
  nodeCount: number;          // nodes.length da fonte antes do merge
  edgeCount: number;          // links.length da fonte antes do merge
}

export interface NodeProvenance {
  id: string;                 // Graphify node id (ex: "src_domain_types_evidence")
  source: SourceId;           // fonte vencedora após merge
  sources: SourceId[];        // todas as fontes que continham este id (para detectar duplicatas)
  source_file?: string;       // preservado de graphify-out/graph.json nodes[].source_file
  source_location?: string;   // L* preservado
  hash: string;               // hash do nó canônico (stable stringify do nó vencedor)
}

export interface EdgeProvenance {
  source: string;             // id origem
  target: string;             // id destino
  provenance: SourceId;       // fonte que contribuiu a aresta
}

export interface FederatedGraph {
  directed: boolean;
  multigraph: boolean;
  graph: Record<string, unknown>;
  nodes: Array<Record<string, unknown> & { id: string; provenance: NodeProvenance }>;
  links: Array<Record<string, unknown> & { source: string; target: string; provenance: SourceId }>;
}

export interface MergeStats {
  sources: GraphProvenance[]; // 1..N fontes lidas (local obrigatório, global opcional)
  totalBeforeDedup: number;   // soma nodes de todas as fontes
  totalAfterDedup: number;    // nodes.length do federated
  deduped: number;            // totalBeforeDedup - totalAfterDedup
  conflicts: number;          // ids com conteúdo divergente (mesmo id, hash diferente)
  edgesMerged: number;
  edgeConflicts: number;
}

export interface FederatedSnapshot {
  version: string;            // semver do pacote behavior-os no momento da federação
  generatedAt: string;        // ISO-8601
  sources: GraphProvenance[];
  stats: MergeStats;
  graphPath: string;          // "graphify-out/federated.json"
  valid: boolean;             // resultado de Federation.validate()
  errors: string[];
}

export interface Federation {
  /** Lê fontes (local obrigatório) e retorna grafo federado em memória (sem escrever disco) */
  federate(opts?: { localPath?: string; globalPaths?: string[] }): Promise<FederatedGraph>;
  /** Merge determinístico puro (sem I/O) — usado em testes */
  merge(graphs: Array<{ source: SourceId; graph: FederatedGraph | { nodes: any[]; links: any[] } }>): FederatedGraph;
  /** Valida snapshot + federated.json (hash, provenance, dedup) */
  validate(snapshot: FederatedSnapshot, graph: FederatedGraph): { valid: boolean; errors: string[] };
  /** Snapshot serializável para federated.json + evidence */
  snapshot(): FederatedSnapshot;
  /** Lê federated.json do disco se existir (adapter) */
  readFederated(): FederatedGraph | null;
  /** Escreve federated.json (adapter) — único escritor */
  writeFederated(graph: FederatedGraph, snapshot: FederatedSnapshot): void;
}
```

**Regras:**

- `SourceId` `"local"` mapeia para `graphify-out/graph.json` (obrigatório, `functional` via `graphifyStatus()`). `"global"` mapeia para `graphify-out/global.json` se existir, senão para cache agregado `graphify-out/cache/*` ou `examples/my-sass/graphify-out/graph.json` quando `FEATURE_FEDERATION_GLOBAL=true`. Fontes extras são `workspace::project` quando `federateKnowledge` é chamado com `tenant`.
- `hash` por fonte = `sha256(readFileSync(path))` hex (primeiros 16 chars no `snapshot`, completo em `provenance` detalhada opcional). Serve para `doctor` detectar staleness sem reler `mtimes` apenas.
- `provenance` por nó **sempre** preserva `source_file`/`source_location` originais do `graphify-out/graph.json`; federação nunca reescreve `label` sem manter `NodeProvenance.sources`.
- `FederatedGraph.nodes[].provenance` é **obrigatório**; nó sem `provenance` falha em `validate()` e `doctor` (fail-closed).
- `Federation.merge()` é puro e determinístico: mesma entrada ordenada por `SourceId` produz mesmo `federated.json` byte-a-byte (usar `sort` por `id` antes de serializar).

---

### 3. Estratégia `merge` — união deduplicada determinística

```
1. load:  read local graphify-out/graph.json (obrigatório) ? GraphProvenance local
          read global(s) se existir e FEATURE_FEDERATION_GLOBAL ou dna.flags.federation === true

2. union: Map<id, Node> para nodes; Map<source|target, Edge> para links

3. dedup nodes:
   - se id não existe ? insert com provenance { source: currentSource, sources: [currentSource] }
   - se id existe ?
     a) se hash(novo) === hash(existente) ? append currentSource em provenance.sources (sem duplicar nó), stats.deduped++
     b) se hash difere ? conflict: manter vencedor por precedência `local > global > lex(SourceId)`
        provenance.sources = [...existentes, currentSource], provenance.source = vencedor
        stats.conflicts++ ; nó vencedor preservado, perdedor descartado mas rastreado em sources
     c) precedência é determinística e documentada; não usa mtime (evita flakiness)

4. dedup edges:
   - key = `${source}?${target}` + tipo se multigraph=false
   - mesma regra de provenance; edge duplicado idêntico ? deduped, divergente ? global ignorado se local existe

5. provenance:
   - cada nó final carrega NodeProvenance com source vencedor + lista completa sources
   - stats.totalBeforeDedup = sum(sources[].nodeCount)

6. snapshot:
   - FederatedSnapshot.stats = { totalBeforeDedup, totalAfterDedup, deduped, conflicts, ... }
   - snapshot.valid = validate().valid
```

**Regras:**

- `local` **sempre** vence conflito quando `hash` diverge (soberania do host). `global` só complementa (adiciona nós novos), nunca sobrescreve `label/source_file` local. Isso preserva `my-saas/src/domain/types.ts` sobre cache global genérico.
- `merge()` ordena `graphs` por `source` (`local` primeiro) para determinismo; `writeFederated` ordena `nodes` por `id` lexicográfico antes de `JSON.stringify` com `2` espaços (evita diff espúrio por ordem de inserção).
- `conflicts > 0` não falha `federate()` — é `warn` em `doctor` e `evidence.federation.conflicts` auditável. Falha apenas se `validate()` encontrar `provenance` ausente ou `hash` vazio (fail-closed).
- `edge` sem `nodes` correspondentes (órfã) é descartada e contada em `edgeConflicts` com `errors: ["orphan edge source?target"]`.

---

### 4. Artefato `graphify-out/federated.json` — evidência observável (Regra de Ouro)

**Schema em disco (via `packages/knowledge/store.ts`):**

```json
{
  "version": "1.3.0",
  "generatedAt": "2026-09-02T15:31:53.793Z",
  "graphPath": "graphify-out/federated.json",
  "sources": [
    {
      "source": "local",
      "path": "graphify-out/graph.json",
      "hash": "a3f7c9d1e2b4a5c6",
      "mtime": "2026-09-02T15:31:50.000Z",
      "freshness": "fresh",
      "nodeCount": 207,
      "edgeCount": 0
    },
    {
      "source": "global",
      "path": "graphify-out/global.json",
      "hash": "9c8b7a6d5e4f3c2b",
      "mtime": "2026-09-02T15:00:00.000Z",
      "freshness": "fresh",
      "nodeCount": 48,
      "edgeCount": 12
    }
  ],
  "stats": {
    "totalBeforeDedup": 255,
    "totalAfterDedup": 250,
    "deduped": 5,
    "conflicts": 0,
    "edgesMerged": 12,
    "edgeConflicts": 0
  },
  "valid": true,
  "errors": [],
  "graph": {
    "directed": false,
    "multigraph": false,
    "graph": {},
    "nodes": [
      {
        "id": "src_domain_types_evidence",
        "label": "Evidence",
        "_origin": "ast",
        "source_file": "src/domain/types.ts",
        "source_location": "L39",
        "provenance": {
          "id": "src_domain_types_evidence",
          "source": "local",
          "sources": ["local"],
          "source_file": "src/domain/types.ts",
          "source_location": "L39",
          "hash": "f1a2b3c4d5e6f7a8"
        }
      }
    ],
    "links": []
  }
}
```

**Regra de Ouro (evidência):**

- `Knowledge Federation` funcional ? `graphify-out/federated.json` existe **e** `JSON.parse` válido **e** `sources.length >= 1` **e** `sources[0].source === "local"` **e** `sources[0].freshness === "fresh"` **e** `stats.totalAfterDedup >= stats.totalBeforeDedup - deduped` **e** `valid === true` **e** `graph.nodes[].provenance.source` definido para todo nó **e** `graph.nodes.length === stats.totalAfterDedup`.
- `src/core/evidence-ledger.ts` após `complete()`: chama `federation.snapshot()` e persiste `evidence.federation` + garante `graphify-out/federated.json` escrito via `packages/knowledge/store.ts` (único escritor).
- `pnpm doctor` verifica: `existsSync(federated.json)` + `JSON.parse` + `sources[local].hash` coincide com `sha256(graph.json)` + `stats` coerente + `valid` + `provenance` por nó.
- `pnpm demo` deve gerar `graphify-out/federated.json` com `sources: [{ source:"local", nodeCount:207 }]` e `stats.totalAfterDedup >= 207` mesmo quando `global` ausente (federação degenerada = local espelhado com provenance).
- `graphify-out/graph.json` permanece fonte canônica local; `federated.json` é derivado — nunca substitui `graph.json` para `GraphifyStatus.functional` (evita regressão da Regra de Ouro existente).

---

### 5. Evidência observável `evidence.federation` + `behavior-os/runtime/federation.json` opcional

**Extensão em `src/domain/types.ts`:**

```ts
export interface Evidence {
  // ...existentes (missionId, workflowId, status, stages, governance, graphify, langgraph, traces, mcp, version, sdk)
  federation?: {
    federatedPath: string; // "graphify-out/federated.json"
    exists: boolean;
    sources: GraphProvenance[];
    stats: MergeStats;
    valid: boolean;
    conflicts: number;
    generatedAt: string;
  };
}
```

**Artefato secundário `behavior-os/runtime/federation.json` (espelho para audit):**

```json
{
  "missionId": "demo",
  "federatedPath": "graphify-out/federated.json",
  "snapshot": { "version":"1.3.0", "sources":[...], "stats":{...}, "valid":true }
}
```

**Regras:**

- `evidence.federation` é snapshot pontual da missão; `graphify-out/federated.json` é estado global (link, não divergência — `evidence.federation.federatedPath` aponta para o global).
- `behavior-os/runtime/federation.json` é opcional em `v1.3` (gerado se `Federation` injetado); `graphify-out/federated.json` é obrigatório (Regra de Ouro). `doctor` gatea o segundo, não o primeiro, para não quebrar retrocompatibilidade quando `Federation` ainda é `Noop`.
- `packages/knowledge/federation.ts` quando `global` ausente ? `stats` reflete `totalBeforeDedup === totalAfterDedup` e `deduped === 0`; `doctor` passa com `warn` "global not found — local only".

---

### 6. Integração com Bootstrap e Gates

```
pnpm install ? pnpm typecheck ? pnpm test ? pnpm demo ? pnpm doctor
                              ? vitest: merge dedup + provenance + local wins + federated.json snapshot
                                                        ? doctor: federated.json exists + valid + provenance per node + hash local
```

- `vitest` deve cobrir: `merge` deduplica id idêntico (`deduped` incrementa, `conflicts` 0), `merge` conflito `local wins` (provenance.source === "local", `conflicts` 1), `NodeProvenance.sources` lista todas as fontes, `snapshot` ordenação determinística, `validate` falha se `provenance` ausente, `federated.json` gerado com `sources[local].nodeCount === graph.json nodes.length`.
- `pnpm demo` deve gerar `behavior-os/runtime/demo.json` com `federation.exists === true` e `graphify-out/federated.json` com `stats.totalAfterDedup >= 207` e `valid: true`.
- `graphify-out/federated.json` deve existir após `demo` (Regra de Ouro: `Configuração não é integração`).

---

## Consequências

**Positivas:**

- `merge` determinístico elimina `local === global` stub; federação vira evidência auditável com `deduped/conflicts` gateáveis.
- `provenance` por nó/aresta fecha rastreabilidade: cada `id` sabe de qual `graphify-out/*.json` veio e se houve conflito; `hash` permite `doctor` detectar divergência sem reler conteúdo.
- `graphify-out/federated.json` + `evidence.federation` fecham Regra de Ouro: federação é artefato, não flag `federated: true` em memória.
- `src/core` desacoplado de `fs/hash`; testes usam `InMemoryFederation` + `merge()` puro sem I/O.
- `local wins` preserva soberania do host (`my-saas/graphify-out/graph.json` nunca sobrescrito por cache global).
- `Federation` como `Port` permite `governance` futuro interceptar `federate()` (ex: bloquear `global` não assinado).

**Negativas / Mitigações:**

- Duplo artefato (`evidence.federation` + `federated.json` + `graph.json`) ? mitigado por `evidence.federation.federatedPath` apontar para `federated.json` (link) e `federated.json.sources[].hash` referenciar `graph.json` (sem duplicação divergente); `federated.json` é derivado, não fonte.
- `sha256` por fonte adiciona I/O em `federate()` ? mitigado por cache `mtime` em `packages/knowledge/store.ts` (só re-hash se `mtime` mudou) e `federate()` chamado apenas em `demo`/`mission` ou `graphify . --federate`.
- `global` opcional gera `warn` não `block` ? mitigado por `doctor` exigir `local` `fresh` mas tolerar `global missing`; `conflicts` auditável impede silencioso `override`.
- Ordenação determinística (`sort` por `id`) pode ocultar ordem de inserção original ? mitigado por `provenance.sources` preservar ordem de descoberta e `generatedAt` auditar quando `merge` ocorreu.

**Gates v1.3.0 (contrato, não exige implementação completa além de tipos + federated.json):**

- [ ] `src/domain/federation.ts` com `Federation`, `FederatedGraph`, `GraphProvenance`, `NodeProvenance`, `MergeStats`, `FederatedSnapshot`
- [ ] `packages/knowledge/federation.ts` reescrito sem `../../src` (usa `behavior-os` + `behavior-os/domain` ou `Federation` Port injetado) + `merge()` determinístico `local wins`
- [ ] `packages/knowledge/store.ts` ? `writeFederated(graph, snapshot)` ? `graphify-out/federated.json` ordenado + `readFederated()` + `hash`
- [ ] `src/domain/types.ts` estendido com `Evidence.federation`
- [ ] `src/core/evidence-ledger.ts` persiste `federation` + escreve `behavior-os/runtime/federation.json` opcional
- [ ] `graphify-out/federated.json` gerado em `demo` com `sources[local].nodeCount >= 207` + `stats.totalAfterDedup >= 207` + `valid: true` + `provenance` por nó
- [ ] `vitest` ? `merge dedup`, `merge conflict local wins`, `provenance sources`, `validate provenance`, `snapshot determinístico`, `federated.json valid`
- [ ] `pnpm doctor` verifica `federated.json` + `evidence.federation` + `hash` local + `provenance` (doctor estendido)

## Alternativas Consideradas

1. **Manter `packages/knowledge/federation.ts` stub `local === global`** — rejeitado: sem `merge` real não há federação; `federated: true` não é evidência gateável e viola Regra de Ouro (sem `federated.json`).
2. **Sobrescrever `graphify-out/graph.json` com `federated.json` (mesmo path)** — rejeitado: `graph.json` é fonte local canônica gateada por `graphifyStatus.functional` (207 nós); sobrescrever perderia `provenance` e quebraria `doctor` existente e `MCP graphify.serve graph.json`.
3. **Sem `provenance` por nó, só `stats` global** — rejeitado: `stats.deduped` não responde "qual nó veio de qual fonte"; auditoria por `mission` exigiria reler fontes originais, não auditável via `federated.json` isolado.
4. **Merge `last-wins` por `mtime` (mais recente vence)** — rejeitado: `mtime` é volátil (clone, `touch`, `cp`) e causaria flakiness; `local wins` determinístico preserva soberania e é testável.
5. **Federação em `behavior-os/runtime/federation.json` apenas (sem `graphify-out/federated.json`)** — rejeitado: viola separação `Graphify` (knowledge layer) vs `Evidence` (mission ledger); `federated.json` deve viver ao lado de `graph.json` para `python -m graphify.serve` e `opencode.json ? mcp.graphify` servirem o grafo federado sem conhecer `behavior-os/runtime`.
6. **Usar `JSON Schema` externo para validar `federated.json` em vez de `Federation.validate()`** — rejeitado: `Federation` já é `Port` injetável; validação deve ser `validate(snapshot, graph)` pura em `src/domain` para `doctor` e `vitest` sem depender de schema externo.

## Referências

- `docs/ARCHITECTURE.md` v1.1 — Fronteiras Kernel/Mission Engine/Evidence/OpenCode/Graphify/LangGraph
- `src/domain/types.ts` ? `Mission` + `Workflow` + `Evidence` (estendido com `federation`)
- `src/adapters/graphify.ts` ? `GraphifyStatus` + `graphifyStatus()` + `graphifyMcpCommand()` (fonte local `graphify-out/graph.json`)
- `packages/adapters/graphify-adapter.ts` ? `KnowledgeProvider` bridge
- `src/core/evidence-ledger.ts` ? `evidencePath()` + `write()` (estendido para `federation`)
- `src/core/mission-engine.ts` ? `executeMission` (orquestra `Federation` injetado)
- `packages/knowledge/federation.ts` (antes: `local === global` stub) ? evolui para `Federation` com `merge()` + `provenance`
- `packages/knowledge/store.ts` (novo) ? `writeFederated`/`readFederated` ? `graphify-out/federated.json`
- `graphify-out/graph.json` (207 nós `fresh`, `nodes[].source_file`, `_origin: "ast"`) — fonte local obrigatória
- `graphify-out/manifest.json` ? `mtime` + `ast_hash` por arquivo (inspiração para `hash` de provenance)
- `graphify-out/federated.json` (novo) ? grafo federado + `FederatedSnapshot` (evidência observável)
- `behavior-os/runtime/<mission>.json` ? `evidence.federation` snapshot por missão
- `behavior-os/runtime/federation.json` (novo opcional) ? espelho de `snapshot` para `audit`
- `opencode.json` ? `mcp.graphify.command: ["python","-m","graphify.serve","graphify-out/graph.json"]` (federado pode ser `federated.json`)
- ADR 001 (Core boundaries), ADR 002 (Evidence-first), ADR 003 (Bootstrap), ADR 005 (OTel), ADR 006 (Control Plane), ADR 007 (McpMarketplace), ADR 008 (SDK Ports)

> **Nota:** Este ADR é **especificação**. Não requer implementação de código em `v1.3.0-proposal` além dos tipos de contrato (`src/domain/federation.ts` + `packages/knowledge/store.ts` esqueleto + geração de `graphify-out/federated.json` em `demo`); gates acima são critérios de aceite quando a Federação for implementada. `graphify-out/graph.json` permanece gate existente; `federated.json` é gate adicional fail-closed apenas quando `Federation` está habilitado (`dna.flags.federation` ou `FEATURE_FEDERATION=true`).
