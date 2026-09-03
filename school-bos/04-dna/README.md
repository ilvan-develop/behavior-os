# BOS-LESSON-040 — DNA: The Behavioral Genome

> Módulo 04 · STABLE · 1.3.0

## Learning objective

Escrever e compor DNA YAML: `personas`, `governance`, `quality`, `workflows`.

## Prerequisites

03 First Mission

## Concept

DNA = genoma comportamental. Define *como* agentes pensam/decidem. `DNALoader` compõe `system+project+workflow+agent` layers. YAML `kind: dna, version, id, personas[], governance[], quality[], workflows[]`.

## Why it matters

Sem DNA, agentes são genéricos; com DNA, têm autoridade, boundaries, skills e permissões determinísticas.

## BehaviorOS implementation

- `dnas/enterprise-governance.yaml:1-66` — exemplo canônico (3 personas, 5 governance, 3 quality)
- `src/core/dna-loader.ts` — compose layers
- `dnas/*.yaml` — 12 patterns v2.0
- `docs/adr/010-dna-patterns.md`

## Architecture

```
dnas/enterprise-governance.yaml
├── personas: architect(+max_modules), backend, qa
├── governance: block(critical), escalate(high), warn(low), log(info)
├── quality: coverage≥80, lint 0, typecheck 0
└── workflows: development { discover→evidence, handoffs }
        ↓ DNALoader compose
        → BehaviorOS({ dnaPath })
```

## Hands-on

```bash
cat dnas/enterprise-governance.yaml
cat dnas/surgical-team.yaml | grep -A5 personas
# Crie dnas/my-dna.yaml:
# kind: dna
# id: my-dna
# version: "1.0.0"
# personas: [{role: backend, name: Solo Dev, authority: implementer, skills: [implementation]}]
```

Teste compose:
```bash
python -c "import yaml; print(yaml.safe_load(open('dnas/enterprise-governance.yaml'))['personas'][0])"
```

## OpenCode prompt

```
Leia dnas/enterprise-governance.yaml e src/core/dna-loader.ts.
Explique personas (authority, boundaries, skills, permission) + governance (4 ações) + quality gates.
Depois crie dnas/my-lab.yaml minimal e valide com yaml.safe_load.
```

## Expected result

Explicação + `dnas/my-lab.yaml` válido que passa `yaml.safe_load`.

## Verification

```bash
python -c "import yaml; yaml.safe_load(open('dnas/my-lab.yaml')); print('valid')"
pnpm typecheck  # não deve quebrar por DNA inválido (loader valida)
```

## Common mistakes

- `permission: {read: allow, edit: deny}` sem `bash` — agente não executa comandos.
- `boundaries: max_modules` sem `value` — loader ignora.

## Troubleshooting

YAML parse error → `python -c "import yaml; yaml.safe_load(open('dnas/X.yaml'))"` mostra linha.

## Challenge

Crie DNA `high-assurance` custom que exige `coverage 90` + `max_modules:1` para `architect`.

## Completion criteria

Cria DNA válido com ≥2 personas + ≥2 governance + ≥1 quality que passa yaml + typecheck.

---

# BOS-LESSON-041 — 12 DNA Patterns

## Learning objective

Diferenciar os 12 patterns e quando usar cada.

## Prerequisites

BOS-LESSON-040

## BehaviorOS implementation

- `dnas/` — 12 arquivos
- `docs/adr/010-dna-patterns.md` — rationale

| Pattern | Uso |
|---------|-----|
| enterprise-governance | audit, compliance |
| surgical-team | time pequeno, alta coesão |
| startup-velocity | ship rápido, warn-heavy |
| platform-team | infra + product |
| autonomous-swarm | multi-mission paralelo |
| research-lab | discovery-heavy |
| incident-response | block-heavy, escalate rápido |
| open-source | community, log-heavy |
| regulated-fintech | high-assurance + OPA |
| product-discovery | discovery + research |
| high-assurance | coverage 90+, strict |
| scaled-enterprise | sub-teams, federation |

## Hands-on

```bash
for f in dnas/*.yaml; do echo "== $f =="; grep -E "id:|description:" "$f" | head -n 2; done
```

## OpenCode prompt

```
Liste os 12 DNAs e para cada: 1 frase de quando usar + 1 diferença chave vs enterprise-governance.
```

## Completion criteria

Justifica escolha para 3 cenários (SaaS solo, fintech, open-source).
