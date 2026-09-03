# TROUBLESHOOTING — BehaviorOS School

> Diagnóstico rápido. Para lição dedicada, veja `14-troubleshooting/README.md`.

## `pnpm doctor` FAIL matrix

| Gate | Causa comum | Fix |
|------|-------------|-----|
| `AGENTS.md` | arquivo movido | `git checkout -- AGENTS.md` |
| `opencode.json $schema` | schema ausente | Verifique `$schema: https://opencode.ai/config.json` |
| `.opencode/agents (8)` | agente faltando | `ls .opencode/agents/*.md` deve ter 8 (architect, implementer, orchestrator, planner, qa, researcher, reviewer, security) |
| `.opencode/skills (8)` | skill faltando | `ls .opencode/skills/` — 9 dirs (inclui graphify-query) |
| `behavior-os/runtime evidence` | nunca rodou demo | `pnpm demo` |
| `graphify functional` | sem `graph.json` | `python -m graphify extract . --code-only` ou `/graphify .` no TUI |
| `langgraph functional` | deps faltando | `pnpm install && pnpm build` |
| `control-plane.json` | sem demo | `pnpm demo` gera `behavior-os/state/control-plane.json` |
| `evidence.version Semver` | version inválida | Ver `package.json:version` deve ser Semver |
| `mcp.json` | sem demo | `pnpm demo` gera `behavior-os/runtime/mcp.json` (45 tools) |
| `federated.json` | sem graph | `pnpm demo` + graphify gera `graphify-out/federated.json` |
| `traces/demo.json` | sem demo | `pnpm demo` gera `behavior-os/runtime/traces/demo.json` (W3C 32/16 hex) |

## Comandos de verificação

```bash
pnpm doctor                          # health completo
pnpm typecheck && pnpm test          # gates obrigatórios
pnpm demo && cat behavior-os/runtime/demo.json | grep COMPLETED
pnpm demo:parallel                   # test+security Promise.all
cat graphify-out/graph.json | python -c "import json,sys; d=json.load(open(sys.argv[1])); print(len(d['nodes']))" graphify-out/graph.json
cat behavior-os/runtime/traces/demo.json | python -c "import json; d=json.load(open('behavior-os/runtime/traces/demo.json')); print(d['traceId'], len(d['spans']))"
```

## Erros comuns por lição

- **DNA YAML inválido** → `yaml` parse error; valide com `python -c "import yaml; yaml.safe_load(open('dnas/meu.yaml'))"`
- **Workflow handoff quebrado** → `doctor` não falha mas `pnpm demo` falha no stage; confira `handoff` keys batem com `stages[].id`
- **Governance block inesperado** → verifique `risk` + `behaviorLevel` + `governance/policy.rego`; use `warn` para testes locais
- **Plugin não carrega** → `opencode.json:plugin` deve apontar `./.opencode/plugins/behaviorOS.ts`, rode `opencode` e veja `plugin loaded`
- **Graphify stale** → `graphify update .` ou `graphify . --update`; compare `git rev-parse HEAD` vs `GRAPH_REPORT.md:Built from commit`

## Quando pedir ajuda

Inclua: `pnpm doctor` output + `behavior-os/runtime/demo.json` (se existir) + `git status` + `node -v && pnpm -v`.
