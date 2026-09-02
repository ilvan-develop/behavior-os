#!/usr/bin/env bash
set -e
echo "=== behaviorOS Bootstrap v1.1.0 ==="
echo "[1/5] install"; pnpm install
echo "[2/5] typecheck"; pnpm typecheck
echo "[3/5] tests"; pnpm test
echo "[4/5] demo (mission → evidence)"; pnpm demo
echo "[5/5] doctor"; pnpm doctor
echo "=== BOOTSTRAP PASS ==="
ls -l behaviorOS/runtime/ || true
if [ -f graphify-out/graph.json ]; then echo "graphify: functional"; else echo "graphify: CONFIGURED (run /graphify .)"; fi
