# Getting Started — behaviorOS 5min

> **Produto:** behaviorOS | **npm:** `behavior-os` | **Comando:** `npx behavior-os init`

Instale governança + pipelines + orquestração em qualquer repo em 5 minutos, sem transformar o host no behaviorOS.

## Pré-requisitos

```bash
node >=18
pnpm >=9    # pnpm --version
python >=3.10 # para graphify (opcional, sem LLM funciona code-only)
```

## 1) Instalar (30s)

Em qualquer pasta host (`my-sass/`, `my-saas/`, repo vazio):

```bash
npx behavior-os init
# ou preset enterprise:
npx behavior-os init --preset enterprise-governance
```

**Cria sem sobrescrever `src/`, `package.json`, `prisma/`:**
- `AGENTS.md`
- `behavior-os/{dna,workflows,missions,runtime}`
- `dnas/enterprise-governance.yaml`
- `.opencode/{agents/8, skills/behavioros, plugins/behaviorOS.ts}`
- `opencode.json` merge (`mcp.graphify` + `plugin[]` lado-a-lado + `permission.external_directory` portável)

## 2) Verificar gates (60s)

No repo raiz do behaviorOS (ou host após `init` + `pnpm install`):

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest 411/411
pnpm demo        # Mission → Evidence → behavior-os/runtime/demo.json COMPLETED
pnpm doctor      # AGENTS.md + .opencode + graphify + evidence
```

Saída esperada `pnpm doctor`:

```
[doctor] AGENTS.md: PASS
[doctor] opencode.json: PASS
[doctor] .opencode/agents: 8/8 PASS
[doctor] .opencode/skills: 7/7 PASS
[doctor] evidence: PASS (behavior-os/runtime/demo.json)
[doctor] graphify: CONFIGURED (run /graphify . to produce graphify-out/graph.json)
[doctor] overall: PASS
```

## 3) Graphify — conhecimento (60s)

**Dentro do IDE (OpenCode):**
```
/graphify .
```

**Headless / CI (sem LLM, só AST):**
```bash
python -m graphify update .
# host exemplo:
python -m graphify update examples/my-sass
ls graphify-out/graph.json                 # raiz: 207 nós
ls examples/my-sass/graphify-out/graph.json # host: 63 nós
```

Evidência observável (Regra de Ouro):
- `graphify-out/graph.json` existe = Graphify funcional
- `behavior-os/runtime/*.json` com `status: COMPLETED` = workflow funcional

## 4) Usar workflows (60s)

```bash
# listar workflows
ls behavior-os/workflows/
# development (8 stages), parallel (test+security em paralelo)

# rodar mission
npx behavior-os mission create minha-feature "implementar RBAC"
npx behavior-os mission run minha-feature
cat behavior-os/runtime/minha-feature.json | grep status
npx behavior-os verify minha-feature
```

## 5) Publicar (quando for release)

```bash
# dry-run local (já OK em v1.2.0)
pnpm publish --dry-run --no-git-checks

# real (precisa NPM_TOKEN no env / GitHub Secrets)
export NPM_TOKEN=npm_xxx         # nunca commitar .env
pnpm publish --access public --no-git-checks

# via GitHub Actions (automático em tag v*):
git tag v1.2.0 -a -m "release v1.2.0"
git push origin v1.2.0
# → .github/workflows/publish.yml usa secrets.NPM_TOKEN
```

Adicione o segredo em GitHub: `Settings → Secrets → Actions → NPM_TOKEN`.

## Host soberano — o que NÃO muda

`npx behavior-os init` **nunca** move `src/` para `behavior-os/`:
- `src/`, `package.json`, `prisma/schema.prisma` intactos
- `behavior-os/` é overlay de governança
- `my-sass` exemplo: `examples/my-sass/src/app.ts` preservado + `behavior-os/` lado-a-lado

## Próximos passos

- `docs/ARCHITECTURE.md` — camadas DNA→Governance→Evidence
- `docs/OS-100-REPORT.md` — evidências v1.2.0 (207 nós, 411/411 tests)
- `docs/INTEGRATION-CONTRACTS.md` — contratos de integração com gates
- `behavior-os/workflows/release.json` — pipeline de release gated

## Troubleshooting

| Erro | Fix |
|---|---|
| `pnpm publish ERR_PNPM_GIT_UNCLEAN` | `git commit` pendências ou `--no-git-checks` |
| `graphify-out/graph.json missing` | `python -m graphify update .` ou `/graphify .` no IDE |
| `NPM_TOKEN not set` | exportar `NPM_TOKEN` ou configurar secret no GitHub |
| `bin behavior-os not found` | `pnpm build` antes de `pnpm publish` |

---
**Tempo total:** ~4min install+gates+graphify. Evidência = `COMPLETED` + `graphify-out/graph.json`.
