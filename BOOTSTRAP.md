# Bootstrap — behaviorOS v1.1.0

Este bootstrap **testa o sistema**, não só cria arquivos.

## Sequência

```
bootstrap.sh / bootstrap.ps1
  → pnpm install
  → pnpm typecheck
  → pnpm test        (3 suítes: kernel + mission + evidence)
  → pnpm demo        (mission demo → behaviorOS/runtime/<id>.json COMPLETED)
  → pnpm doctor      (AGENTS.md + .opencode/* + governance + graphify-out detection)
  → pnpm audit (opcional)
```

Falha em qualquer gate bloqueia o ZIP/entrega.

## Uso

```bash
# Linux/macOS
bash scripts/bootstrap.sh

# Windows
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
```

## Verificação manual

```bash
pnpm install && pnpm typecheck && pnpm test && pnpm demo && pnpm doctor
ls behaviorOS/runtime/        # deve conter *.json com status COMPLETED
cat graphify-out/graph.json    # só existe após /graphify . (não é criado pelo bootstrap)
```

## Saída esperada do doctor

```
[doctor] AGENTS.md: PASS
[doctor] opencode.json: PASS
[doctor] .opencode/agents: 8/8 PASS
[doctor] .opencode/skills: 7/7 PASS
[doctor] behaviorOS/config: PASS
[doctor] evidence: PASS (1 runtime file)
[doctor] graphify: CONFIGURED (run /graphify . to produce graphify-out/graph.json)
[doctor] overall: PASS
```
