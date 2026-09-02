# Operations — como operar behaviorOS instalado

## Comandos diários

```bash
pnpm demo      # roda missão demo
pnpm doctor    # saúde
/graphify .    # (dentro do TUI) gera conhecimento
graphify query "auth flow" --graph graphify-out/graph.json
```

## Instalador em host

```bash
npx behaviorOS init   # idempotente, preserva src/ e package.json
```

## Troubleshooting

- `AGENTS.md ausente` → doctor FAIL → criar a partir de template.
- `opencode.json invalid` → validar contra https://opencode.ai/config.json, usar `OPENCODE_DISABLE_PROJECT_CONFIG=1` para reparar.
- `graphify functional:false` → esperado até rodar `/graphify .`.
