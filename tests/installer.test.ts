import { describe, it, expect } from "vitest";
import { init } from "../src/cli/init.js";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("installer — npx behavior-os init", () => {
  it("creates AGENTS.md, behavior-os and opencode.json in fresh host", async () => {
    const host = mkdtempSync(join(tmpdir(), "bos-host-"));
    // host vazio
    const r = await init(host);
    expect(existsSync(join(host, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(host, "opencode.json"))).toBe(true);
    expect(existsSync(join(host, "behavior-os", "workflows", "development.json"))).toBe(true);
    expect(r.doctor.pass).toBe(true);
    expect(r.created.length).toBeGreaterThan(3);
    // segunda chamada não sobrescreve
    const r2 = await init(host);
    expect(r2.skipped).toContain("AGENTS.md");
    rmSync(host, { recursive: true, force: true });
  });

  it("preserves host src/ if exists (sovereignty)", async () => {
    const host = mkdtempSync(join(tmpdir(), "bos-host2-"));
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(join(host, "src"), { recursive: true });
    writeFileSync(join(host, "src", "app.ts"), "host code", "utf-8");
    await init(host);
    expect(existsSync(join(host, "src", "app.ts"))).toBe(true);
    rmSync(host, { recursive: true, force: true });
  });
});
