import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const RT_DIR = join(process.cwd(), "behavior-os", "runtime");
const JOURNAL = join(RT_DIR, "gate-journal.jsonl");
const PROPOSAL = join(RT_DIR, "next-mission-proposal.json");

async function loadPlugin() {
  const mod = await import("../.opencode/plugins/behaviorOS.js");
  const plugin = mod.default as any;
  const logs: string[] = [];
  const hooks = await plugin({ client: { app: { log: async ({ body }: any) => logs.push(body.message) } } } as any);
  return { hooks, logs };
}

function journalEntries(): any[] {
  if (!existsSync(JOURNAL)) return [];
  const raw = readFileSync(JOURNAL, "utf-8");
  if (!raw.trim()) return [];
  return raw.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

describe("plugin v3.8 — remediation path (isenção + reset + control-plane + journal-failure)", () => {
  let journalBackup: string | null = null;
  let proposalBackup: string | null = null;

  beforeEach(() => {
    journalBackup = existsSync(JOURNAL) ? readFileSync(JOURNAL, "utf-8") : null;
    proposalBackup = existsSync(PROPOSAL) ? readFileSync(PROPOSAL, "utf-8") : null;
    rmSync(JOURNAL, { force: true });
    rmSync(PROPOSAL, { force: true });
    rmSync(join(RT_DIR, "remediation-reset.json"), { force: true });
  });

  afterEach(() => {
    rmSync(JOURNAL, { force: true });
    rmSync(join(RT_DIR, "remediation-reset.json"), { force: true });
    if (journalBackup !== null) writeFileSync(JOURNAL, journalBackup, "utf-8");
    if (proposalBackup !== null) writeFileSync(PROPOSAL, proposalBackup, "utf-8");
    else rmSync(PROPOSAL, { force: true });
  });

  it("isenção: comandos do ciclo de missão e verificação passam livres e não contam para recidiva", async () => {
    const { hooks } = await loadPlugin();
    const sess = "sess-exempt";
    const before = (tool: string, callID: string, args: Record<string, unknown> = {}) =>
      hooks["tool.execute.before"]({ tool, sessionID: sess, callID }, { args });

    // 1ª violação real
    await expect(before("edit", "e1", { filePath: "src/a.ts" })).resolves.toBeUndefined();
    // remédio: ciclo de missão + verificação — todos isentos
    await expect(before("bash", "m1", { command: "npx behavior-os mission run foo" })).resolves.toBeUndefined();
    await expect(before("bash", "m2", { command: "behavior-os mission create foo bar" })).resolves.toBeUndefined();
    await expect(before("bash", "m3", { command: "npx tsx src/cli/index.ts mission status foo" })).resolves.toBeUndefined();
    await expect(before("bash", "v1", { command: "pnpm test" })).resolves.toBeUndefined();
    await expect(before("bash", "v2", { command: "pnpm typecheck" })).resolves.toBeUndefined();
    await expect(before("bash", "v3", { command: "pnpm doctor" })).resolves.toBeUndefined();
    await expect(before("bash", "v4", { command: "npx vitest run tests/x.test.ts" })).resolves.toBeUndefined();
    await expect(before("bash", "v5", { command: "behavior-os verify demo" })).resolves.toBeUndefined();

    // journal: 1 violação real + 8 protocol-command (isentos, não contam)
    const entries = journalEntries();
    const real = entries.filter((e) => e.detail !== "protocol-command");
    const exempt = entries.filter((e) => e.detail === "protocol-command");
    expect(real.length).toBe(1);
    expect(exempt.length).toBe(8);

    // 2ª violação real ainda escala (se isentos contassem, já estaríamos bloqueados)
    await expect(before("edit", "e2", { filePath: "src/b.ts" })).resolves.toBeUndefined();
    // 3ª violação real → recidiva bloqueia (prova que só reais contam: 1 + 1 + 1)
    await expect(before("edit", "e3", { filePath: "src/c.ts" })).rejects.toThrow("protocol recidivism");
  });

  it("reset: evidence nova zera o placar da sessão (violações antigas ignoradas)", async () => {
    mkdirSync(RT_DIR, { recursive: true });
    const sess = "sess-reset";
    // 2 violações antigas (ts 1h atrás)
    const oldTs = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    for (let i = 0; i < 2; i++) {
      appendFileSync(
        JOURNAL,
        JSON.stringify({ ts: oldTs, kind: "mission-guard", tool: "edit", sessionID: sess, decision: "allowed", reason: "old" }) + "\n",
        "utf-8"
      );
    }
    // atividade de missão nova: evidence fresca (mtime agora) reseta o placar
    writeFileSync(join(RT_DIR, "remediation-reset.json"), JSON.stringify({ status: "COMPLETED", startedAt: new Date().toISOString() }), "utf-8");

    const { hooks } = await loadPlugin();
    const before = (tool: string, callID: string, args: Record<string, unknown> = {}) =>
      hooks["tool.execute.before"]({ tool, sessionID: sess, callID }, { args });

    // sem reset, 2 antigas + 1 nova já dariam recidiva na 2ª; com reset: 2 novas escalam
    await expect(before("edit", "r1", { filePath: "src/a.ts" })).resolves.toBeUndefined();
    await expect(before("write", "r2", { filePath: "src/b.ts" })).resolves.toBeUndefined();
    // 3ª nova → bloqueia (placar contou só pós-evidence)
    await expect(before("edit", "r3", { filePath: "src/c.ts" })).rejects.toThrow("protocol recidivism");
  });

  it("behaviorOS control-plane tool passa livre, journala protocol-command e não injeta reminder", async () => {
    const { hooks } = await loadPlugin();
    await expect(
      hooks["tool.execute.before"]({ tool: "behaviorOS", sessionID: "s-cp", callID: "cp1" }, { args: { action: "status" } })
    ).resolves.toBeUndefined();
    const entries = journalEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].detail).toBe("protocol-command");
    expect(entries[0].reason).toContain("control-plane");

    const output = { title: "behaviorOS", output: "status ok", metadata: {} };
    await hooks["tool.execute.after"]({ tool: "behaviorOS", sessionID: "s-cp", callID: "cp1" }, output);
    expect(output.output).toBe("status ok");
  });

  it("journal-failure: falha ao escrever não derruba a tool e loga warn (fail-open auditado)", async () => {
    mkdirSync(RT_DIR, { recursive: true });
    // força falha: JOURNAL vira diretório → appendFileSync lança → appendJournal retorna false
    rmSync(JOURNAL, { force: true });
    mkdirSync(JOURNAL, { recursive: true });
    try {
      const { hooks, logs } = await loadPlugin();
      await expect(
        hooks["tool.execute.before"](
          { tool: "edit", sessionID: "s-jf", callID: "jf1" },
          { args: { filePath: "src/a.ts" } }
        )
      ).resolves.toBeUndefined();
      expect(logs.join(" ")).toContain("FALHA ao escrever gate-journal.jsonl");
      // feedback de protocolo ainda ocorre (auditoria incompleta, mas rota corrigida)
      const output = { title: "edit", output: "Edit applied", metadata: {} };
      await hooks["tool.execute.after"]({ tool: "edit", sessionID: "s-jf", callID: "jf1" }, output);
      expect(output.output).toContain("[behaviorOS]");
    } finally {
      rmSync(JOURNAL, { recursive: true, force: true });
    }
  });
});
