import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * plugin.test.ts — v3.5: o plugin é self-contained (contrato de execução).
 * Self-evolution foi movido do hook session.idle do OpenCode para o CLI
 * (`pnpm self-test`), onde roda sob controle e governance — não em idle.
 * Os gates do plugin (protected paths, mission guard, agent rules,
 * fail-closed) são cobertos em tests/plugin-guard.test.ts.
 */
describe("plugin behaviorOS v3.5 — contrato de execução", () => {
  it("plugin source is self-contained (no imports de packages/ — host-safe)", () => {
    const code = readFileSync(join(process.cwd(), ".opencode", "plugins", "behaviorOS.ts"), "utf-8");
    expect(code.includes("../../packages")).toBe(false);
  });

  it("plugin still exposes tool.execute.before hook", async () => {
    const mod = await import("../.opencode/plugins/behaviorOS.js");
    const plugin = mod.default as any;
    expect(typeof plugin).toBe("function");
    const hooks = await plugin({ client: { app: { log: async () => {} } } } as any);
    expect(hooks["tool.execute.before"]).toBeDefined();
  });

  it("self-evolution moved to CLI self-test (runs under control, not idle)", async () => {
    const { discoverSelfEvolution } = await import("../packages/orchestrator/self-evolution.js");
    const discovery = discoverSelfEvolution("demo");
    expect(discovery).toHaveProperty("gaps");
    expect(discovery).toHaveProperty("proposals");
    expect(discovery).toHaveProperty("coverage");
  });
});
