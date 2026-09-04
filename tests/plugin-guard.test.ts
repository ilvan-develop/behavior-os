import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const RT_DIR = join(process.cwd(), "behavior-os", "runtime");
const JOURNAL = join(RT_DIR, "gate-journal.jsonl");
const TMP_MISSION = join(RT_DIR, "plugin-guard-test.json");

async function loadPlugin() {
  const mod = await import("../.opencode/plugins/behaviorOS.js");
  const plugin = mod.default as any;
  const logs: string[] = [];
  const hooks = await plugin({ client: { app: { log: async ({ body }: any) => logs.push(body.message) } } } as any);
  return { hooks, logs };
}

/** args fresh a cada chamada — o hook muta output.args */
function call(hooks: any, tool: string, args: Record<string, unknown> = {}) {
  return hooks["tool.execute.before"]({ tool, sessionID: "sess-test", callID: "c1" }, { args });
}

function readJournal(): string[] {
  if (!existsSync(JOURNAL)) return [];
  return readFileSync(JOURNAL, "utf-8").trim().split("\n").filter(Boolean);
}

describe("plugin behaviorOS v3.5 — contrato de execução self-contained", () => {
  let journalBackup: string | null = null;
  let missionBackup: string | null = null;

  beforeEach(() => {
    if (existsSync(JOURNAL)) journalBackup = readFileSync(JOURNAL, "utf-8");
    else journalBackup = null;
    if (existsSync(JOURNAL)) rmSync(JOURNAL);
    if (existsSync(TMP_MISSION)) missionBackup = readFileSync(TMP_MISSION, "utf-8");
    else missionBackup = null;
  });

  afterEach(() => {
    rmSync(JOURNAL, { force: true });
    if (journalBackup !== null) writeFileSync(JOURNAL, journalBackup, "utf-8");
    if (missionBackup !== null) writeFileSync(TMP_MISSION, missionBackup, "utf-8");
    else rmSync(TMP_MISSION, { force: true });
  });

  it("loads and exposes tool.execute.before (self-contained: no external imports beyond builtin + @opencode-ai/plugin)", async () => {
    const { hooks } = await loadPlugin();
    expect(typeof hooks["tool.execute.before"]).toBe("function");
    const src = await import("node:fs");
    const code = src.readFileSync(join(process.cwd(), ".opencode", "plugins", "behaviorOS.ts"), "utf-8");
    expect(code.includes("../../packages")).toBe(false); // self-contained — funciona em qualquer host
  });

  it("Gate 1: blocks .env read unconditionally (fail-closed)", async () => {
    const { hooks } = await loadPlugin();
    await expect(call(hooks, "read", { filePath: ".env" })).rejects.toThrow("Gateway blocked protected path .env");
    await expect(call(hooks, "read", { filePath: "src/.env" })).rejects.toThrow("protected path");
    // .env.example passa
    await expect(call(hooks, "read", { filePath: ".env.example" })).resolves.toBeUndefined();
    // journal registra o block
    expect(readJournal().join(" ")).toContain("protected-path");
  });

  it("Gate 1: blocks bash touching .env", async () => {
    const { hooks } = await loadPlugin();
    await expect(call(hooks, "bash", { command: "cat .env" })).rejects.toThrow("protected path");
  });

  it("read-only tools pass free", async () => {
    const { hooks } = await loadPlugin();
    await expect(call(hooks, "read", { filePath: "src/index.ts" })).resolves.toBeUndefined();
    await expect(call(hooks, "grep", { pattern: "x" })).resolves.toBeUndefined();
    await expect(call(hooks, "glob", { pattern: "**/*.ts" })).resolves.toBeUndefined();
    await expect(call(hooks, "task", {})).resolves.toBeUndefined();
    expect(readJournal()).toEqual([]);
  });

  it("Mission guard: edit sem missão vigente → allowed + journal (escalate)", async () => {
    const { hooks, logs } = await loadPlugin();
    await expect(call(hooks, "edit", { filePath: "src/app.ts", content: "x" })).resolves.toBeUndefined();
    const entries = readJournal();
    expect(entries.length).toBe(1);
    const e = JSON.parse(entries[0]);
    expect(e.kind).toBe("mission-guard");
    expect(e.decision).toBe("allowed");
    expect(e.tool).toBe("edit");
    expect(e.sessionID).toBe("sess-test");
    expect(logs.join(" ")).toContain("mission guard");
  });

  it("Mission guard: com missão IN_PROGRESS vigente → allowed SEM registro", async () => {
    writeFileSync(TMP_MISSION, JSON.stringify({ status: "IN_PROGRESS", startedAt: new Date().toISOString() }), "utf-8");
    const { hooks } = await loadPlugin();
    await expect(call(hooks, "write", { filePath: "src/app.ts", content: "x" })).resolves.toBeUndefined();
    expect(readJournal()).toEqual([]);
  });

  it("Mission guard: missão IN_PROGRESS antiga (>24h) não conta como vigente", async () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    writeFileSync(TMP_MISSION, JSON.stringify({ status: "IN_PROGRESS", startedAt: old }), "utf-8");
    const { hooks } = await loadPlugin();
    await expect(call(hooks, "edit", { filePath: "src/app.ts" })).resolves.toBeUndefined();
    expect(readJournal().length).toBe(1); // escalou
  });

  it("agent rules embutidas: security write → blocked (fail-closed)", async () => {
    writeFileSync(TMP_MISSION, JSON.stringify({ status: "IN_PROGRESS", startedAt: new Date().toISOString() }), "utf-8");
    const { hooks } = await loadPlugin();
    await expect(call(hooks, "write", { agent: "security", filePath: "src/x.ts" })).rejects.toThrow("Gateway blocked: security cannot write");
    expect(readJournal().join(" ")).toContain("agent-gate");
  });

  it("agent rules embutidas: researcher edit/bash → blocked", async () => {
    writeFileSync(TMP_MISSION, JSON.stringify({ status: "IN_PROGRESS", startedAt: new Date().toISOString() }), "utf-8");
    const { hooks } = await loadPlugin();
    await expect(call(hooks, "edit", { agent: "researcher", filePath: "src/x.ts" })).rejects.toThrow("Gateway blocked: researcher is read-only");
  });

  it("unknown tool → fail-closed block (nunca logar e seguir)", async () => {
    const { hooks } = await loadPlugin();
    await expect(call(hooks, "quantum_write", {})).rejects.toThrow("unknown tool");
    expect(readJournal().join(" ")).toContain("gate-error");
  });

  it("canonical gateway module keeps same rules (API compat)", async () => {
    const { canExecute } = await import("../packages/gateway/gateway.js");
    expect(canExecute("write", "security", "security-audit").allowed).toBe(false);
    expect(canExecute("edit", "researcher", "development").allowed).toBe(false);
    expect(canExecute("edit", "implementer", "development").allowed).toBe(true);
  });
});
