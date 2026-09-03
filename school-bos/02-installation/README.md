# BOS-LESSON-020 — Installation: Host Sovereignty

> Módulo 02 · STABLE · 1.3.0

## Learning objective

Instalar o BOS em qualquer host (`my-sass/`) sem tocar `src/` do host.

## Prerequisites

01 What is BOS

## Concept

Soberania do host: `npx behavior-os init` é **scaffolder**, não migrador. Cria `behavior-os/`, `dnas/`, `.opencode/`; preserva `src/`, `package.json`, `prisma/`, `apps/`. Prova em `examples/my-sass/` (gitignored, 19 arquivos).

## Why it matters

Você pode adotar BOS em projeto existente sem reescrever.

## BehaviorOS implementation

- `src/cli/init.ts` — CLI `init` + `--preset` + `preserves`
- `behavior-os/config/profiles.json:15` — `installer.preserves: ["src/","package.json","prisma/","apps/"]`
- `examples/my-sass/` — host fresco local
- `package.json:bin` — `behavior-os: dist/src/cli/index.js`

## Architecture

```
my-sass/ (host)
├── src/app.ts        # preservado
├── package.json      # preservado
├── behavior-os/      # criado (19 workflows)
├── dnas/             # criado (12 patterns)
└── .opencode/        # criado (8 agents, 9 skills)
```

## Hands-on

```bash
mkdir /tmp/my-sass-test && cd /tmp/my-sass-test
echo '{"name":"my-sass","version":"1.0.0"}' > package.json
mkdir src && echo 'export const app="my-sass"' > src/app.ts
npx behavior-os init --preset enterprise-governance
ls src/app.ts  # deve existir
ls behavior-os/workflows/ | wc -l  # 18+
```

Se estiver no repo behaviorOS, use `pnpm install && pnpm build` (dev).

## OpenCode prompt

```
Verifique soberania do host: crie /tmp/my-sass-test com src/app.ts, rode npx behavior-os init,
e prove que src/app.ts foi preservado. Liste arquivos criados em behavior-os/ e .opencode/.
```

## Expected result

`src/app.ts` intacto + `behavior-os/` criado + `doctor` PASS.

## Verification

```bash
test -f src/app.ts && echo "host preserved"
test -f behavior-os/workflows/development.json && echo "BOS installed"
pnpm doctor 2>&1 | grep "overall: PASS"
```

## Common mistakes

- Rodar `init` dentro do próprio repo behaviorOS sem `--force` — use host temporário.
- `node <18` ou `pnpm <9` — veja `package.json:engines`.

## Troubleshooting

`init` falhou → `node -v && pnpm -v` + `cat behavior-os/config/profiles.json`.

## Challenge

Teste 2 presets: `surgical-team` vs `startup-velocity` e compare `dnas/*.yaml`.

## Completion criteria

Host com `src/app.ts` preservado + `behavior-os/` + `doctor PASS`.

---

# BOS-LESSON-021 — Presets & 12 DNA Patterns

## Learning objective

Escolher preset correto entre 12 (`enterprise-governance` ... `scaled-enterprise`).

## Prerequisites

BOS-LESSON-020

## BehaviorOS implementation

- `dnas/*.yaml` (12) — `enterprise-governance`, `surgical-team`, `startup-velocity`, `platform-team`, `autonomous-swarm`, `research-lab`, `incident-response`, `open-source`, `regulated-fintech`, `product-discovery`, `high-assurance`, `scaled-enterprise`
- `docs/adr/010-dna-patterns.md`

## Hands-on

```bash
ls dnas/*.yaml
cat dnas/surgical-team.yaml | head -n 30
cat dnas/startup-velocity.yaml | head -n 30
diff dnas/enterprise-governance.yaml dnas/surgical-team.yaml | head
```

## OpenCode prompt

```
Compare 3 DNAs (enterprise-governance, surgical-team, startup-velocity):
personas, governance rules, quality gates. Recomende qual usar para SaaS solo vs enterprise auditado.
```

## Completion criteria

Consegue justificar escolha de preset para 2 cenários.
