# ADR 003 — Bootstrap tests the system

## Decisão

`scripts/bootstrap.sh|ps1` executa `install → typecheck → test → demo → doctor`. Falha bloqueia entrega (ZIP).

## Consequência

Erros como AGENTS.md ausente são detectados pelo próprio bootstrap antes de chegar ao usuário, forçando correção.
