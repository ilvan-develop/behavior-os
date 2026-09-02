import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { evidenceLedger } from "../src/core/evidence-ledger.js";

describe("evidence ledger", () => {
  it("writes COMPLETED evidence file", async () => {
    const mission = { id: "test-evidence", title:"t", goal:"g", workflowId:"development", createdAt:new Date().toISOString(), inputs:{} } as any;
    const workflow = { id:"development", version:"1.1.0", stages:[{id:"discover", agent:"researcher", skill:"discover", gated:false}], handoffs:{} } as any;
    const ledger = evidenceLedger(mission, workflow);
    ledger.start();
    const evidence = ledger.complete();
    expect(evidence.status).toBe("COMPLETED");
    const p = join(process.cwd(),"behavior-os","runtime","test-evidence.json");
    expect(existsSync(p)).toBe(true);
    const j = JSON.parse(readFileSync(p,"utf-8"));
    expect(j.missionId).toBe("test-evidence");
    // cleanup
    rmSync(p, { force:true });
  });
});
