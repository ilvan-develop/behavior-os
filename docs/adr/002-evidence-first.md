# ADR 002 — Evidence-first

## Decisão

Configuração não é integração. Toda integração exige artefato em disco (`graphify-out/graph.json`, `behaviorOS/runtime/*.json`).

## Consequência

Doctor e demo verificam existência de arquivos, não só declaração em JSON. Evita falsos positivos de instalação.
