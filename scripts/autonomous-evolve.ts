#!/usr/bin/env tsx
/** Modo Autónomo Fechado — Behavior OS evolui-se a si próprio
 * Loop: autonomous → discover → Gateway → evolution → evidence → novo ciclo
 * Sem intervenção humana, evidence-driven.
 */
import { runAutonomous } from "../src/core/autonomous.ts";
import { discoverSelfEvolution } from "../packages/orchestrator/self-evolution.ts";
import { canExecute } from "../packages/gateway/gateway.ts";

async function main() {
  console.log("[autonomous] modo fechado iniciado — Behavior OS a evoluir-se");
  let iter = 0;
  const maxIter = 3;
  while (iter < maxIter) {
    iter++;
    console.log(`\n[autonomous] === iteração ${iter}/${maxIter} ===`);
    // 1. Executa chain autónoma (development + parallel)
    const auto = await runAutonomous("autonomous-demo");
    console.log(`[autonomous] chain ${auto.chainId} → ${auto.overall} — ${auto.missions.join(",")}`);
    // 2. Descobre gaps
    const disc = discoverSelfEvolution("demo");
    console.log(`[autonomous] discover: gaps=${disc.gaps.length} proposals=${disc.proposals.length} coverage=${disc.coverage.global}%`);
    if (disc.gaps.length === 0 && disc.proposals.length === 0) {
      console.log("[autonomous] nenhum gap — volução concluída, sistema estável");
      break;
    }
    // 3. Gateway check antes de evoluir
    for (const p of disc.proposals) {
      if (!p) continue;
      const decision = canExecute("write", "orchestrator", "autonomous");
      console.log(`[autonomous] proposal ${p.kind} → Gateway: ${decision.allowed ? "ALLOW" : "BLOCK"} — ${p.reason}`);
      if (!decision.allowed) {
        console.log(`[autonomous] evolução bloqueada por DNA invariants — mantém stability`);
        continue;
      }
      console.log(`[autonomous] evolução aplicada: ${p.kind} — ${JSON.stringify(p.dnaPatch)}`);
    }
    if (disc.proposals.length === 0) {
      console.log("[autonomous] gaps sem proposta — aguarda próxima missão");
      break;
    }
  }
  console.log("\n[autonomous] modo fechado finalizado — evidence em behavior-os/runtime/autonomous-demo.json + self-evolution.json (se houver)");
}

main();
