Write-Host "=== behaviorOS Bootstrap v1.1.0 ===" -ForegroundColor Cyan
Write-Host "[1/5] install"; pnpm install; if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "[2/5] typecheck"; pnpm typecheck; if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "[3/5] tests"; pnpm test; if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "[4/5] demo"; pnpm demo; if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "[5/5] doctor"; pnpm doctor; if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "=== BOOTSTRAP PASS ===" -ForegroundColor Green
Get-ChildItem -LiteralPath "behaviorOS/runtime" -ErrorAction SilentlyContinue | Format-Table Name,Length
if (Test-Path "graphify-out/graph.json") { Write-Host "graphify: functional" } else { Write-Host "graphify: CONFIGURED (run /graphify .)" }
