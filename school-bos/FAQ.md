# FAQ — BehaviorOS School

## Geral

**O BOS substitui meu projeto?**
Não. Soberania do host: `npx behavior-os init` cria `behavior-os/`, `dnas/`, `.opencode/` sem tocar `src/` ou `package.json`. Ver `examples/my-sass/` (gitignored).

**Preciso de Python?**
Só para Graphify (`python -m graphify extract .`). Sem Python, o BOS funciona; `doctor` mostra `CONFIGURED` em vez de `functional`.

**Qual a diferença entre School, Docs e Social?**
- Docs (`docs/`) = como o sistema funciona.
- School (`school-bos/`) = como humanos aprendem o sistema.
- Social (`social/`) = como o ecossistema comunica o sistema.

## Instalação

**`npx behavior-os init` falhou?**
`node >=18`, `pnpm >=9` obrigatórios. Veja `02-installation/README.md`.

**Posso escolher DNA?**
Sim: `npx behavior-os init --preset surgical-team` etc. 12 presets em `dnas/`.

## Missions & Evidence

**Onde está a prova de execução?**
`behavior-os/runtime/*.json` com `status: COMPLETED`. `pnpm demo` gera `demo.json`. `doctor` valida.

**`overall 100` significa o quê?**
Evaluator coverage: `stages + governance + graphify + langgraph` completos. Ver `src/domain/types.ts:Evidence.evaluator`.

## Governance

**`block` vs `escalate`?**
`block` = execução interrompida imediatamente (ex: `risk:high` sem aprovação). `escalate` = encaminha para `security` reviewer humano. `warn`/`log` auto-aprovados via `opencode.json: "*": "allow"` + `plugins/behaviorOS.ts`.

## Graphify / LangGraph / MCP

**Graphify é obrigatório?**
Não, mas recomendado. `graphify-out/graph.json` (207 nodes) + `federated.json` dão conhecimento consultável. `doctor` detecta.

**LangGraph paralelo funciona hoje?**
Sim: `src/workflow/langgraph-graph.ts:buildParallelGraph` fan-out `implement → test+security` → `review`, testado e2e, `pnpm demo:parallel`.

**Quantos MCP tools?**
45, listados em `behavior-os/runtime/mcp.json` após `pnpm demo`. Tool canônica: `behaviorOS` com `argsShape [action, missionId]`.

## Troubleshooting

**`pnpm doctor` FAIL?**
Leia `14-troubleshooting/README.md` e `TROUBLESHOOTING.md`. Cada FAIL tem hint no output.

**Posso usar Claude Code / Cursor?**
Sim, `docs/GETTING-STARTED.md` cobre `Claude Code + Cursor + opencode`. AGENTS.md é lido por todos.

## Contribuição

Veja `CONTRIBUTING.md` e `social/CONTENT-QUALITY-GATES.md`. Todo conteúdo precisa passar: accuracy, evidence, audience, CTA, traceability.
