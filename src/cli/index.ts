#!/usr/bin/env node
/** CLI — behavior-os {init,doctor,status,mission,evidence,verify}
 * Pequena e poderosa, conforme spec 21.
 */
import { init } from "./init.js";

const cmd = process.argv[2];

async function main() {
  switch (cmd) {
    case "init":
    case undefined: {
      const res = await init(process.cwd());
      console.log(`[behavior-os] init → ${res.doctor.pass ? "PASS" : "FAIL"} — ${res.created.length} created`);
      break;
    }
    case "doctor": {
      await import("./doctor.js");
      break;
    }
    case "status": {
      const { graphifyStatus } = await import("../adapters/graphify.js");
      const { langGraphStatus } = await import("../adapters/langgraph.js");
      const g = graphifyStatus();
      const lg = langGraphStatus();
      console.log(`[status] graphify: ${g.functional ? `functional ${g.nodeCount} nodes` : "configured"}`);
      console.log(`[status] langgraph: ${lg.available ? `functional ${lg.nodeCount} nodes` : lg.reason}`);
      const { readdirSync, existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      const rt = join(process.cwd(), "behavior-os", "runtime");
      const n = existsSync(rt) ? readdirSync(rt).filter((f: string) => f.endsWith(".json")).length : 0;
      console.log(`[status] evidence: ${n} runtime files`);
      break;
    }
    case "mission": {
      const sub = process.argv[3];
      const id = process.argv[4];
      if (sub === "create" && id) {
        const { writeFileSync, mkdirSync } = await import("node:fs");
        const { join, dirname } = await import("node:path");
        const p = join(process.cwd(), "behavior-os", "missions", `${id}.json`);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, JSON.stringify({ id, title: id, goal: process.argv.slice(5).join(" ") || id, workflowId: "development", createdAt: new Date().toISOString(), inputs: {} }, null, 2));
        console.log(`[mission] created ${p}`);
      } else if (sub === "run" && id) {
        const { executeMission } = await import("../core/mission-engine.js");
        const { join } = await import("node:path");
        const r = await executeMission(join(process.cwd(), `behavior-os/missions/${id}.json`), join(process.cwd(), "behavior-os/workflows/development.json"));
        console.log(`[mission] run ${id} → ${r.evidence.status}`);
      } else if (sub === "status" && id) {
        const { readFileSync, existsSync } = await import("node:fs");
        const { join } = await import("node:path");
        const p = join(process.cwd(), "behavior-os", "runtime", `${id}.json`);
        if (existsSync(p)) console.log(readFileSync(p, "utf-8"));
        else console.log(`[mission] no evidence for ${id}`);
      } else {
        console.log(`usage: behavior-os mission {create <id> <goal>|run <id>|status <id>}`);
      }
      break;
    }
    case "evidence": {
      const { readdirSync, readFileSync, existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      const id = process.argv[3];
      if (id) {
        const p = join(process.cwd(), "behavior-os", "runtime", `${id}.json`);
        if (existsSync(p)) console.log(readFileSync(p, "utf-8"));
        else console.log(`no evidence for ${id}`);
      } else {
        const rt = join(process.cwd(), "behavior-os", "runtime");
        const files = existsSync(rt) ? readdirSync(rt).filter((f: string) => f.endsWith(".json")) : [];
        for (const f of files) {
          const j = JSON.parse(readFileSync(join(rt, f), "utf-8"));
          console.log(`${f}: ${j.status} — graphify:${j.graphify?.nodeCount} langgraph:${j.langgraph?.nodeCount} evaluator:${j.evaluator?.coverage?.overall}%`);
        }
      }
      break;
    }
    case "verify": {
      const id = process.argv[3] ?? "demo";
      const { readFileSync, existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      const p = join(process.cwd(), "behavior-os", "runtime", `${id}.json`);
      if (!existsSync(p)) { console.log(`[verify] no evidence for ${id}`); break; }
      const e = JSON.parse(readFileSync(p, "utf-8"));
      const ok = e.evaluator?.approved && e.evaluator?.coverage?.overall === 100;
      console.log(`[verify] ${id}: ${ok ? "PASS" : "FAIL"} — evaluator approved:${e.evaluator?.approved} coverage:${e.evaluator?.coverage?.overall}%`);
      break;
    }
    default:
      console.log(`Behavior OS CLI — usage:
  behavior-os init
  behavior-os doctor
  behavior-os status
  behavior-os mission create <id> <goal>
  behavior-os mission run <id>
  behavior-os mission status <id>
  behavior-os evidence [id]
  behavior-os verify [id]
`);
  }
}

main();
