import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const RT_DIR = join(process.cwd(), "behavior-os", "runtime");
const STATE_DIR = join(process.cwd(), "behavior-os", "state");
const JOURNAL = join(RT_DIR, "gate-journal.jsonl");
const PROPOSAL = join(RT_DIR, "next-mission-proposal.json");
const CP = join(STATE_DIR, "control-plane.json");
const MISSIONS_DIR = join(process.cwd(), "behavior-os", "missions");

async function loadPlugin() {
  const mod = await import("../.opencode/plugins/behaviorOS.js");
  const plugin = mod.default as any;
  const logs: string[] = [];
  const hooks = await plugin({ client: { app: { log: async ({ body }: any) => logs.push(body.message) } } } as any);
  return { hooks, logs };
}

function call(hooks: any, tool: string, callID: string, args: Record<string, unknown> = {}) {
  return hooks["tool.execute.before"]({ tool, sessionID: "sess-rec", callID }, { args });
}

function journalEntries(): any[] {
  if (!existsSync(JOURNAL)) return [];
  return readFileSync(JOURNAL, "utf-8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

describe("plugin v3.7 — agência autônoma (recidiva + auto-execução com flag)", () => {
  let backups: Record<string, string | null> = {};

  beforeEach(() => {
    delete process.env.FEATURE_SELFEVOLUTION;
    for (const f of [JOURNAL, PROPOSAL, CP]) backups[f] = existsSync(f) ? readFileSync(f, "utf-8") : null;
    rmSync(JOURNAL, { force: true });
    rmSync(PROPOSAL, { force: true });
    const before = existsSync(MISSIONS_DIR) ? join(MISSIONS_DIR) : null;
    backups["auto-missions"] = before ? JSON.stringify(readFileSync != null ? [] : []) : null;
  });

  afterEach(() => {
    rmSync(JOURNAL, { force: true });
    for (const f of [JOURNAL, PROPOSAL, CP]) {
      if (backups[f] !== null) writeFileSync(f, backups[f] as string, "utf-8");
      else rmSync(f, { force: true });
    }
    // limpa fixtures de teste no runtime (gap-mission etc.) e missões auto-criadas
    for (const f of ["gap-mission.json", "rec-mission.json"]) {
      rmSync(join(RT_DIR, f), { force: true });
    }
    if (existsSync(MISSIONS_DIR)) {
      const { readdirSync } = require("node:fs") as typeof import("node:fs");
      for (const f of readdirSync(MISSIONS_DIR)) {
        if (f.startsWith("auto-")) rmSync(join(MISSIONS_DIR, f), { force: true });
      }
    }
    delete process.env.FEATURE_SELFEVOLUTION;
  });

  it("isAutonomyEnabled: env FEATURE_SELFEVOLUTION=true → true (precedência oficial)", async () => {
    const { isAutonomyEnabled } = await import("../.opencode/plugins/behaviorOS.js");
    process.env.FEATURE_SELFEVOLUTION = "true";
    expect(isAutonomyEnabled(process.cwd())).toBe(true);
    process.env.FEATURE_SELFEVOLUTION = "false";
    expect(isAutonomyEnabled(process.cwd())).toBe(false);
    delete process.env.FEATURE_SELFEVOLUTION;
  });

  it("isAutonomyEnabled: sem env, lê control-plane flags (fail-closed default false)", async () => {
    const { isAutonomyEnabled } = await import("../.opencode/plugins/behaviorOS.js");
    // control-plane real do repo agora tem selfEvolution: true (dogfooding)
    const cp = JSON.parse(readFileSync(CP, "utf-8"));
    expect(isAutonomyEnabled(process.cwd())).toBe(cp.flags?.selfEvolution?.enabled === true);
  });

  it("recidiva: 3ª mutação sem missão na mesma sessão → BLOQUEIA (2 chances de escala)", async () => {
    const { hooks } = await loadPlugin();
    await expect(call(hooks, "edit", "c1")).resolves.toBeUndefined(); // 1ª: escala (1/3)
    await expect(call(hooks, "write", "c2")).resolves.toBeUndefined(); // 2ª: escala (2/3)
    // 3ª: recidiva — bloqueia
    await expect(call(hooks, "edit", "c3")).rejects.toThrow("protocol recidivism");
    // journal registra o block
    const blocked = journalEntries().filter((e) => e.decision === "blocked" && e.reason.includes("recidivism"));
    expect(blocked.length).toBe(1);
  });

  it("recidiva: missão IN_PROGRESS vigente reseta — sem bloqueio mesmo após violações antigas", async () => {
    mkdirSync(RT_DIR, { recursive: true });
    // 3 violações pré-existentes de outra sessão
    for (let i = 0; i < 3; i++) {
      appendFileSync(JOURNAL, JSON.stringify({ ts: new Date().toISOString(), kind: "mission-guard", tool: "edit", sessionID: "outra-sessao", decision: "allowed", reason: "x" }) + "\n", "utf-8");
    }
    writeFileSync(join(RT_DIR, "rec-mission.json"), JSON.stringify({ status: "IN_PROGRESS", startedAt: new Date().toISOString() }), "utf-8");
    const { hooks } = await loadPlugin();
    // com missão vigente, mutação passa livre (não conta violação)
    await expect(call(hooks, "edit", "c-ok")).resolves.toBeUndefined();
    expect(journalEntries().filter((e) => e.decision === "blocked")).toEqual([]);
  });

  it("agência OFF (default em hosts): propõe mas NUNCA cria/executa missão", async () => {
    mkdirSync(RT_DIR, { recursive: true });
    appendFileSync(JOURNAL, JSON.stringify({ ts: new Date().toISOString(), kind: "mission-guard", tool: "edit", sessionID: "s1", decision: "allowed", reason: "x" }) + "\n", "utf-8");
    // força OFF via env (precedência máxima)
    process.env.FEATURE_SELFEVOLUTION = "false";
    const { hooks, logs } = await loadPlugin();
    await hooks["session.idle"]();
    const p = JSON.parse(readFileSync(PROPOSAL, "utf-8"));
    expect(p.autonomy).toBe(false);
    expect(logs.join(" ")).toContain("Nada foi executado automaticamente");
    // nenhuma missão auto-* criada
    const { readdirSync } = await import("node:fs");
    const autos = readdirSync(MISSIONS_DIR).filter((f) => f.startsWith("auto-"));
    expect(autos).toEqual([]);
  });

  it("agência ON: cria missão governada e executa via CLI (evidence COMPLETED ou falha registrada)", async () => {
    mkdirSync(RT_DIR, { recursive: true });
    // gap de evidence → proposta bugfix
    writeFileSync(join(RT_DIR, "gap-mission.json"), JSON.stringify({ missionId: "gap-mission", status: "COMPLETED", evaluator: { approved: false, feedback: ["coverage 60 < 80"] } }), "utf-8");
    process.env.FEATURE_SELFEVOLUTION = "true";
    const { hooks, logs } = await loadPlugin();
    await hooks["session.idle"]();
    const p = JSON.parse(readFileSync(PROPOSAL, "utf-8"));
    expect(p.autonomy).toBe(true);
    expect(p.workflowId).toBe("bugfix");
    const logsText = logs.join(" ");
    expect(logsText).toContain("AGENCY");
    expect(logsText).toContain("autonomia ON");
    // missão auto-* foi criada com schema oficial
    const { readdirSync } = await import("node:fs");
    const autos = readdirSync(MISSIONS_DIR).filter((f) => f.startsWith("auto-"));
    expect(autos.length).toBe(1);
    const m = JSON.parse(readFileSync(join(MISSIONS_DIR, autos[0]), "utf-8"));
    expect(m.id).toBe(autos[0].replace(".json", ""));
    expect(m.workflowId).toBe("bugfix");
    expect(m.inputs.autonomous).toBe(true);
  }, 15000);

  it("healthy + autonomia ON → no proposal, sem execução", async () => {
    mkdirSync(RT_DIR, { recursive: true });
    process.env.FEATURE_SELFEVOLUTION = "true";
    const { hooks, logs } = await loadPlugin();
    await hooks["session.idle"]();
    const p = JSON.parse(readFileSync(PROPOSAL, "utf-8"));
    expect(p.workflowId).toBe("");
    expect(logs.join(" ")).not.toContain("AGENCY");
  });
});
