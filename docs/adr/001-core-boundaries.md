# ADR 001 — Core boundaries

## Decisão

Separar `src/domain` (types), `src/core` (kernel, mission, governance, evidence), `src/workflow` (state, engine), `src/adapters` (opencode, graphify, langgraph).

## Consequência

Kernel não importa adapters. Evidence é a única saída observável. Facilita teste unitário e substituição de LangGraph.
