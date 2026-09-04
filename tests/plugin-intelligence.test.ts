import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const RT_DIR = join(process.cwd(), "behavior-os", "runtime");
const JOURNAL = join(RT_DIR, "gate-journal.jsonl");
const PROPOSAL = join(RT_DIR, "next-mission-proposal.json");
const TMP_MISSION = join(RT_DIR, "plugin-iq-test.json");

async function loadPlugin() {
  const mod = await import("../.opencode/plugins/behaviorOS.js");
  const plugin = mod.default as any;
  const logs: string[] = [];
  const hooks = await plugin({ client: { app: { log: async ({ body }: any) => logs.push(body.message) } } } as any);
  return { hooks, logs };
}

describe("plugin v3.6 — inteligência ativa (feedback loop + mission proposal)", () => {
  let journalBackup: string | null = null;
  let proposalBackup: string | null = null;
  let missionBackup: string | null = null;

  beforeEach(() => {
    journalBackup = existsSync(JOURNAL) ? readFileSync(JOURNAL, "utf-8") : null;
    proposalBackup = existsSync(PROPOSAL) ? readFileSync(PROPOSAL, "utf-8") : null;
    missionBackup = existsSync(TMP_MISSION) ? readFileSync(TMP_MISSION, "utf-8") : null;
    rmSync(JOURNAL, { force: true });
    rmSync(PROPOSAL, { force: true });
    rmSync(TMP_MISSION, { force: true });
  });

  afterEach(() => {
    rmSync(JOURNAL, { force: true });
    if (journalBackup !== null) writeFileSync(JOURNAL, journalBackup, "utf-8");
    if (proposalBackup !== null) writeFileSync(PROPOSAL, proposalBackup, "utf-8");
    else rmSync(PROPOSAL, { force: true });
    if (missionBackup !== null) writeFileSync(TMP_MISSION, missionBackup, "utf-8");
    else rmSync(TMP_MISSION, { force: true });
  });

  it("exposes all three hooks: before, after, session.idle", async () => {
    const { hooks } = await loadPlugin();
    expect(hooks["tool.execute.before"]).toBeDefined();
    expect(hooks["tool.execute.after"]).toBeDefined();
    expect(hooks["session.idle"]).toBeDefined();
  });

  it("feedback loop: mutating without mission → protocol reminder INJECTED into tool output (model reads it)", async () => {
    const { hooks } = await loadPlugin();
    const args = { filePath: "src/app.ts", content: "x" };
    await hooks["tool.execute.before"]({ tool: "edit", sessionID: "s1", callID: "c1" }, { args });
    const output = { title: "edit", output: "Edit applied", metadata: {} };
    await hooks["tool.execute.after"]({ tool: "edit", sessionID: "s1", callID: "c1" }, output);
    expect(output.output).toContain("[behaviorOS]");
    expect(output.output).toContain("Discover");
    expect(output.output).toContain("mission create");
  });

  it("feedback loop: mutating WITH active mission → NO reminder injected", async () => {
    mkdirSync(RT_DIR, { recursive: true });
    writeFileSync(TMP_MISSION, JSON.stringify({ status: "IN_PROGRESS", startedAt: new Date().toISOString() }), "utf-8");
    const { hooks } = await loadPlugin();
    const args = { filePath: "src/app.ts", content: "x" };
    await hooks["tool.execute.before"]({ tool: "edit", sessionID: "s1", callID: "c2" }, { args });
    const output = { title: "edit", output: "Edit applied", metadata: {} };
    await hooks["tool.execute.after"]({ tool: "edit", sessionID: "s1", callID: "c2" }, output);
    expect(output.output).toBe("Edit applied");
  });

  it("feedback loop: read-only tools never inject reminder", async () => {
    const { hooks } = await loadPlugin();
    await hooks["tool.execute.before"]({ tool: "grep", sessionID: "s1", callID: "c3" }, { args: { pattern: "x" } });
    const output = { title: "grep", output: "results...", metadata: {} };
    await hooks["tool.execute.after"]({ tool: "grep", sessionID: "s1", callID: "c3" }, output);
    expect(output.output).toBe("results...");
  });

  it("session.idle: journal violations → PROPOSES mission (writes next-mission-proposal.json, no auto-execution)", async () => {
    mkdirSync(RT_DIR, { recursive: true });
    appendFileSync(JOURNAL, JSON.stringify({ ts: new Date().toISOString(), kind: "mission-guard", tool: "edit", sessionID: "s1", decision: "allowed", reason: "no active mission" }) + "\n", "utf-8");
    const { hooks, logs } = await loadPlugin();
    await hooks["session.idle"]();
    expect(existsSync(PROPOSAL)).toBe(true);
    const p = JSON.parse(readFileSync(PROPOSAL, "utf-8"));
    expect(p.workflowId).toBe("development");
    expect(p.sources.journalViolations).toBe(1);
    expect(p.title).not.toBe("No proposal — protocol healthy");
    // nunca auto-executa: nenhuma missão nova criada além do proposal
    const logsText = logs.join(" ");
    expect(logsText).toContain("PROPOSAL");
    expect(logsText).toContain("Nada foi executado automaticamente");
  });

  it("session.idle: evidence gap (evaluator disapproved) → proposes bugfix mission first", async () => {
    mkdirSync(RT_DIR, { recursive: true });
    writeFileSync(TMP_MISSION, JSON.stringify({ missionId: "broken-mission", status: "COMPLETED", evaluator: { approved: false, feedback: ["coverage 60 < 80"] } }), "utf-8");
    const { hooks } = await loadPlugin();
    await hooks["session.idle"]();
    const p = JSON.parse(readFileSync(PROPOSAL, "utf-8"));
    expect(p.workflowId).toBe("bugfix");
    expect(p.sources.evidenceGaps[0]).toContain("broken-mission");
  });

  it("session.idle: healthy state → first run writes proposal (workflowId empty)", async () => {
    mkdirSync(RT_DIR, { recursive: true });
    const { hooks, logs } = await loadPlugin();
    await hooks["session.idle"]();
    expect(existsSync(PROPOSAL)).toBe(true);
    const p = JSON.parse(readFileSync(PROPOSAL, "utf-8"));
    expect(p.workflowId).toBe("");
    expect(p.title).toBe("No proposal — protocol healthy");
    expect(logs.join(" ")).toContain("self-evolution");
  });

  it("session.idle: dedup — same proposal not rewritten (2nd run logs 'no new proposal')", async () => {
    mkdirSync(RT_DIR, { recursive: true });
    appendFileSync(JOURNAL, JSON.stringify({ ts: new Date().toISOString(), kind: "mission-guard", tool: "edit", sessionID: "s1", decision: "allowed", reason: "x" }) + "\n", "utf-8");
    const { hooks, logs } = await loadPlugin();
    await hooks["session.idle"](); // 1ª vez: escreve + loga PROPOSAL
    expect(existsSync(PROPOSAL)).toBe(true);
    const first = readFileSync(PROPOSAL, "utf-8");
    const mtimeFirst = existsSync(PROPOSAL) ? 1 : 0;
    await hooks["session.idle"](); // 2ª vez: dedup — não reescreve
    expect(readFileSync(PROPOSAL, "utf-8")).toBe(first);
    expect(mtimeFirst).toBe(1);
    const lastLog = logs[logs.length - 1];
    expect(lastLog).toContain("no new proposal");
  });
});
