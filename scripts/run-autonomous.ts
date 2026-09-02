import { runAutonomous } from "../src/core/autonomous.ts";
const r = await runAutonomous("autonomous-demo");
console.log(`[autonomous] chain ${r.chainId} → ${r.overall} — missions: ${r.missions.join(", ")}`);
console.log(`[autonomous] evidence: behavior-os/runtime/${r.chainId}.json`);
