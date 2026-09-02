# Architecture — behaviorOS v1.1.0

## Modelo operacional

```
Mission → Workflow Engine (declarativo) → Orchestrator → Agents (8) → Skills (7) → Governance → Evidence Ledger → Verify/Audit
                                          ↘ OpenCode (execução) + Graphify (conhecimento) + LangGraph (durable, v1.2)
```

Workflow não é prompt gigante. É `behaviorOS/workflows/*.json` com `stages` e `handoffs`. Cada stage tem `agent` e `skill` fixos.

## Fronteiras

- **Kernel:** Atomic/Animal/Celestial/Military em `src/core/behavior-kernel.ts`
- **Mission Engine:** `src/core/mission-engine.ts` (load → validate → run → evidence)
- **Evidence:** `behaviorOS/runtime/<id>.json` com `status: COMPLETED` é a única prova.
- **OpenCode:** superfície de execução (`.opencode/*` nativo). Não inventar paths.
- **Graphify:** conhecimento (graphify-out/graph.json, MCP). Não autoridade.
- **LangGraph:** runtime durável opcional; em v1.1 é fronteira gateada, não integrada.

## Installer

`npx behaviorOS init` instala em qualquer host preservando `src/`, `package.json`, `prisma/`. O host não vira behaviorOS.
