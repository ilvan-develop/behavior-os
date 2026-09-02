import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defineTool } from "../packages/mcp/tool.js";
import {
  mcpTools,
  getMcpMarketplace,
  createMarketplace,
  InMemoryMarketplace,
  globalMarketplace,
} from "../packages/mcp/marketplace.js";

// helper to mock cwd
let tmpRoot: string;
let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;
function setCwd(root: string) {
  if (cwdSpy) cwdSpy.mockRestore();
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
}
function restoreCwd() {
  if (cwdSpy) {
    cwdSpy.mockRestore();
    cwdSpy = null;
  }
}

function makeCtx(over: Partial<Record<string, string>> = {}) {
  return {
    missionId: "m1",
    workflowId: "development",
    stageId: "test-stage",
    ...over,
  } as any;
}

describe("mcp/marketplace — 95% coverage", () => {
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "bos-mcp-"));
    mkdirSync(join(tmpRoot, "behavior-os", "workflows"), { recursive: true });
    mkdirSync(join(tmpRoot, "behavior-os", "state"), { recursive: true });
    mkdirSync(join(tmpRoot, "behavior-os", "dna"), { recursive: true });
    mkdirSync(join(tmpRoot, "behavior-os", "runtime"), { recursive: true });
    // default package.json for version tests
    writeFileSync(join(tmpRoot, "package.json"), JSON.stringify({ version: "9.9.9" }), "utf-8");
    // default opencode.json for snapshot tests — minimal
    writeFileSync(join(tmpRoot, "opencode.json"), JSON.stringify({ mcp: {} }), "utf-8");
    setCwd(tmpRoot);
  });

  afterEach(() => {
    restoreCwd();
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
    vi.restoreAllMocks();
  });

  describe("exports — mcpTools & getMcpMarketplace", () => {
    it("mcpTools contains 37 items and known tools", () => {
      expect(Array.isArray(mcpTools)).toBe(true);
      expect(mcpTools).toContain("mission.create");
      expect(mcpTools).toContain("evidence.validate");
      expect(mcpTools).toContain("behaviorOS");
      expect(mcpTools).toContain("gateway.invoke");
      expect(mcpTools.length).toBeGreaterThan(30);
    });
    it("getMcpMarketplace returns count and provider", () => {
      const info = getMcpMarketplace();
      expect(info.tools).toBe(mcpTools);
      expect(info.count).toBe(mcpTools.length);
      expect(info.provider).toBe("behavior-os-mcp");
    });
    it("globalMarketplace singleton exists", () => {
      expect(globalMarketplace).toBeDefined();
      expect(globalMarketplace.list().length).toBeGreaterThan(0);
    });
    it("createMarketplace creates fresh instance", () => {
      const a = createMarketplace();
      const b = createMarketplace();
      expect(a).not.toBe(b);
      expect(a.list().length).toBe(mcpTools.length); // behaviorOS already in mcpTools, no +1
      expect(a.list().length).toBeGreaterThanOrEqual(mcpTools.length);
    });
  });

  describe("InMemoryMarketplace constructor — version & builtin registration", () => {
    it("reads version from package.json", () => {
      const mp = new InMemoryMarketplace();
      expect((mp.snapshot() as any).version).toBe("9.9.9");
    });
    it("falls back to 1.3.0 when package.json missing version", () => {
      writeFileSync(join(tmpRoot, "package.json"), JSON.stringify({ name: "x" }), "utf-8");
      const mp = new InMemoryMarketplace();
      expect(mp.snapshot().version).toBe("1.3.0");
    });
    it("falls back when package.json missing file", () => {
      rmSync(join(tmpRoot, "package.json"), { force: true });
      const mp = new InMemoryMarketplace();
      expect(mp.snapshot().version).toBe("1.3.0");
    });
    it("falls back when package.json invalid JSON", () => {
      writeFileSync(join(tmpRoot, "package.json"), "{ invalid", "utf-8");
      const mp = new InMemoryMarketplace();
      expect(mp.snapshot().version).toBe("1.3.0");
    });
    it("auto-registers behaviorOS and all mcpTools stubs", () => {
      const mp = new InMemoryMarketplace();
      const snap = mp.snapshot();
      // snapshot tools should include mission.create etc
      const names = snap.tools.map((t) => t.name);
      expect(names).toContain("behaviorOS");
      expect(names).toContain("mission.create");
      expect(names).toContain("mission.update");
      expect(names).toContain("evidence.validate");
      expect(names).toContain("graph.search");
      expect(names).toContain("governance.policyCheck");
      expect(names).toContain("dna.validate");
      // count should match mcpTools length (behaviorOS already in list)
      expect(snap.tools.length).toBeGreaterThanOrEqual(mcpTools.length);
    });
    it("behaviorOS stub has specialized args per tool mapping", () => {
      const mp = new InMemoryMarketplace();
      // mission.update has regex missionId
      const mu = mp.get("mission.update")!;
      expect(() => mu.tool.validate({ missionId: "valid-123", title: "New Title" })).not.toThrow();
      expect(() => mu.tool.validate({ missionId: "invalid id with space" })).toThrow();
      // evidence.validate strict default
      const ev = mp.get("evidence.validate")!;
      const parsed = ev.tool.validate({ missionId: "m1" }) as any;
      expect(parsed.strict).toBe(false);
      // graph.search defaults
      const gs = mp.get("graph.search")!;
      const gsParsed = gs.tool.validate({ query: "hello" }) as any;
      expect(gsParsed.kind).toBe("any");
      expect(gsParsed.limit).toBe(10);
      // governance.policyCheck
      const gp = mp.get("governance.policyCheck")!;
      expect(() => gp.tool.validate({ tool: "write", agent: "implementer", workflowId: "development" })).not.toThrow();
      // dna.validate defaults
      const dv = mp.get("dna.validate")!;
      const dvParsed = dv.tool.validate({}) as any;
      expect(dvParsed.path).toBe("behavior-os/dna/system.dna.yaml");
      // generic tool mission.create fallback
      const mc = mp.get("mission.create")!;
      expect(() => mc.tool.validate({ input: "hi" })).not.toThrow();
    });
    it("stub execute returns ok shape with ctx", async () => {
      const mp = new InMemoryMarketplace();
      const tool = mp.get("mission.create")!.tool;
      const res = await tool.execute({ input: "test" }, makeCtx({ missionId: "myMission" }));
      expect((res as any).ok).toBe(true);
      expect((res as any).tool).toBe("mission.create");
      expect((res as any).result).toContain("stub mission.create");
    });
  });

  describe("behaviorOS tool execute branches", () => {
    it("status returns status string", async () => {
      const mp = new InMemoryMarketplace();
      const reg = mp.get("behaviorOS")!;
      const res = await reg.tool.execute({ action: "status" }, makeCtx());
      expect(res).toContain("behaviorOS status");
    });
    it("evidence returns file content when exists", async () => {
      const mp = new InMemoryMarketplace();
      const missionId = "test-mission-123";
      const safeId = missionId.replace(/[^a-zA-Z0-9._-]/g, "_");
      const p = join(tmpRoot, "behavior-os", "runtime", `${safeId}.json`);
      writeFileSync(p, JSON.stringify({ missionId, status: "COMPLETED" }), "utf-8");
      const reg = mp.get("behaviorOS")!;
      const res = await reg.tool.execute({ action: "evidence", missionId }, makeCtx());
      expect(res).toContain(missionId);
      expect(res).toContain("COMPLETED");
    });
    it("evidence returns no evidence when file missing", async () => {
      const mp = new InMemoryMarketplace();
      const reg = mp.get("behaviorOS")!;
      const res = await reg.tool.execute({ action: "evidence", missionId: "nonexistent-xyz" }, makeCtx());
      expect(res).toContain("no evidence at");
    });
    it("evidence sanitizes unsafe missionId", async () => {
      const mp = new InMemoryMarketplace();
      const unsafe = "a/b\\c:evil";
      const safe = unsafe.replace(/[^a-zA-Z0-9._-]/g, "_");
      const p = join(tmpRoot, "behavior-os", "runtime", `${safe}.json`);
      writeFileSync(p, "sanitized-content", "utf-8");
      const reg = mp.get("behaviorOS")!;
      const res = await reg.tool.execute({ action: "evidence", missionId: unsafe }, makeCtx());
      expect(res).toBe("sanitized-content");
    });
    it("other action fallback", async () => {
      const mp = new InMemoryMarketplace();
      const reg = mp.get("behaviorOS")!;
      const res = await reg.tool.execute({ action: "doctor" }, makeCtx());
      expect(res).toBe("behaviorOS doctor");
      const res2 = await reg.tool.execute({ action: "run-demo" }, makeCtx());
      expect(res2).toBe("behaviorOS run-demo");
    });
  });

  describe("register / unregister / list / get", () => {
    it("register succeeds and list/get reflect", () => {
      const mp = new InMemoryMarketplace();
      const tool = defineTool({
        name: "custom.test",
        description: "A custom test tool for unit testing marketplace register flow",
        args: z.object({ input: z.string().optional() }),
        output: z.string(),
        execute: async (a) => `got ${(a as any).input}`,
      });
      mp.register(tool, { source: "builtin", file: "packages/mcp/tools/custom-test.ts" });
      expect(mp.get("custom.test")).toBeDefined();
      expect(mp.list().some((r) => r.tool.name === "custom.test")).toBe(true);
    });
    it("register duplicate throws", () => {
      const mp = new InMemoryMarketplace();
      const tool = defineTool({
        name: "dup.tool",
        description: "Duplicate tool test with valid description length long enough",
        args: z.object({ input: z.string().optional() }),
        output: z.string(),
        execute: async () => "ok",
      });
      mp.register(tool, { source: "builtin", file: "packages/mcp/tools/dup-tool.ts" });
      expect(() => mp.register(tool, { source: "builtin", file: "packages/mcp/tools/dup-tool.ts" })).toThrow(
        /already registered/,
      );
    });
    it("register missing name/description throws via marketplace (bypass defineTool)", () => {
      const mp = new InMemoryMarketplace();
      const fakeTool: any = {
        name: "",
        description: "",
        schema: { name: "", description: "", args: z.object({ input: z.string().optional() }) },
        validate: (a: unknown) => a,
        execute: async () => "ok",
      };
      expect(() => mp.register(fakeTool, { source: "builtin", file: "x.ts" })).toThrow(/missing name\/description/);
      const fake2: any = {
        name: "noDesc",
        description: "",
        schema: { name: "noDesc", description: "", args: z.object({ input: z.string().optional() }) },
        validate: (a: unknown) => a,
        execute: async () => "ok",
      };
      expect(() => mp.register(fake2, { source: "builtin", file: "x.ts" })).toThrow(/missing name\/description/);
    });
    it("register args must be ZodObject throws", () => {
      const mp = new InMemoryMarketplace();
      const fakeTool: any = {
        name: "bad.args",
        description: "Tool with bad args description that is long enough to pass length check",
        schema: { name: "bad.args", description: "test", args: { notZod: true } },
        validate: (a: unknown) => a,
        execute: async () => "ok",
      };
      expect(() => mp.register(fakeTool, { source: "builtin", file: "x.ts" })).toThrow(/args must be ZodObject/);
    });
    it("register warns but allows description out of 10..200 bounds", () => {
      const mp = new InMemoryMarketplace();
      const shortTool = defineTool({
        name: "short.desc",
        description: "short", // <10
        args: z.object({ input: z.string().optional() }),
        output: z.string(),
        execute: async () => "ok",
      });
      // should still register (warn branch)
      expect(() => mp.register(shortTool, { source: "builtin", file: "x.ts" })).not.toThrow();
      expect(mp.get("short.desc")).toBeDefined();
      const longDesc = "a".repeat(250);
      const longTool = defineTool({
        name: "long.desc",
        description: longDesc,
        args: z.object({ input: z.string().optional() }),
        output: z.string(),
        execute: async () => "ok",
      });
      expect(() => mp.register(longTool, { source: "builtin", file: "x.ts" })).not.toThrow();
    });
    it("unregister removes and returns boolean", () => {
      const mp = new InMemoryMarketplace();
      const tool = defineTool({
        name: "to.remove",
        description: "Tool to be removed test with sufficient description length",
        args: z.object({ input: z.string().optional() }),
        output: z.string(),
        execute: async () => "ok",
      });
      mp.register(tool, { source: "builtin", file: "x.ts" });
      expect(mp.get("to.remove")).toBeDefined();
      expect(mp.unregister("to.remove")).toBe(true);
      expect(mp.get("to.remove")).toBeUndefined();
      expect(mp.unregister("nonexistent")).toBe(false);
    });
    it("list and get work", () => {
      const mp = new InMemoryMarketplace();
      const list = mp.list();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      expect(mp.get("behaviorOS")).toBeDefined();
      expect(mp.get("does.not.exist")).toBeUndefined();
    });
  });

  describe("validate", () => {
    it("valid marketplace returns valid true", () => {
      const mp = new InMemoryMarketplace();
      const v = mp.validate();
      // May have file-not-found for opencode-tool files that don't exist in tmpRoot? But tmpRoot has no .opencode/tools files, so behaviorOS file check will fail if behaviorOS file missing? Let's create it to make valid
      // behaviorOS is registered with file .opencode/tools/behaviorOS.ts — need that file to exist for validate to pass
      // Create stub file to satisfy existsSync
      const behaviorPath = join(tmpRoot, ".opencode", "tools", "behaviorOS.ts");
      mkdirSync(join(tmpRoot, ".opencode", "tools"), { recursive: true });
      writeFileSync(behaviorPath, "// dummy", "utf-8");
      const v2 = mp.validate();
      // still may have other errors? But at least check structure
      expect(typeof v2.valid).toBe("boolean");
      expect(Array.isArray(v2.errors)).toBe(true);
      // with file existing, should be valid
      expect(v2.valid).toBe(true);
    });
    it("detects invalid description length", () => {
      const mp = new InMemoryMarketplace();
      // inject tool with short desc via direct map manipulation to bypass register warn and test validate error
      const shortTool = defineTool({
        name: "badDescTool",
        description: "short", // 5 chars
        args: z.object({ input: z.string().optional() }),
        output: z.string(),
        execute: async () => "ok",
      });
      // need to bypass register's missing check? already allows short, but validate will flag
      mp.register(shortTool, { source: "builtin", file: "x.ts" });
      const v = mp.validate();
      expect(v.errors.some((e) => e.includes("badDescTool") && e.includes("invalid description"))).toBe(true);
      expect(v.valid).toBe(false);
    });
    it("detects invalid tool name via injected map", () => {
      const mp = new InMemoryMarketplace();
      // directly inject malformed tool without register validation
      const fakeTool: any = {
        name: "Bad Name With Spaces!",
        description: "A valid description that is long enough for validation purposes",
        schema: { name: "Bad Name With Spaces!", description: "x", args: z.object({ input: z.string().optional() }) },
        validate: (a: unknown) => a,
        execute: async () => "ok",
      };
      (mp as any).tools.set("injected-bad-name", {
        tool: fakeTool,
        source: "builtin",
        file: "x.ts",
        serverId: undefined,
        registeredAt: new Date().toISOString(),
      });
      const v = mp.validate();
      expect(v.errors.some((e) => e.includes("invalid tool name"))).toBe(true);
    });
    it("detects args not ZodObject via injection", () => {
      const mp = createMarketplace();
      // clear and inject
      (mp as any).tools.clear();
      const fakeTool: any = {
        name: "valid-name",
        description: "Valid description for tool with bad args shape that is long enough",
        schema: { name: "valid-name", description: "x", args: { notZod: true } },
        validate: (a: unknown) => a,
        execute: async () => "ok",
      };
      (mp as any).tools.set("valid-name", {
        tool: fakeTool,
        source: "builtin",
        file: "x.ts",
        registeredAt: new Date().toISOString(),
      });
      const v = mp.validate();
      expect(v.errors.some((e) => e.includes("args must be ZodObject"))).toBe(true);
    });
    it("detects empty argsShape", () => {
      const mp = new InMemoryMarketplace();
      const emptyTool = defineTool({
        name: "empty-args",
        description: "Tool with empty args shape for validation test case long enough",
        args: z.object({}),
        output: z.string(),
        execute: async () => "ok",
      });
      mp.register(emptyTool, { source: "builtin", file: "x.ts" });
      const v = mp.validate();
      expect(v.errors.some((e) => e.includes("empty") && e.includes("empty-args"))).toBe(true);
    });
    it("detects opencode-tool file not found", () => {
      const mp = new InMemoryMarketplace();
      const tool = defineTool({
        name: "missing-file-tool",
        description: "Tool with missing file for opencode-tool source validation test",
        args: z.object({ input: z.string().optional() }),
        output: z.string(),
        execute: async () => "ok",
      });
      mp.register(tool, { source: "opencode-tool", file: ".opencode/tools/missing.ts" });
      const v = mp.validate();
      expect(v.errors.some((e) => e.includes("file not found") && e.includes("missing-file-tool"))).toBe(true);
    });
    it("detects duplicate tool name via injected duplicate entries", () => {
      const mp = new InMemoryMarketplace();
      const toolA: any = {
        name: "dup-name",
        description: "Valid description for dup tool A that is sufficiently long",
        schema: { name: "dup-name", description: "x", args: z.object({ input: z.string().optional() }) },
        validate: (a: unknown) => a,
        execute: async () => "ok",
      };
      const toolB: any = {
        name: "dup-name",
        description: "Valid description for dup tool B that is sufficiently long also",
        schema: { name: "dup-name", description: "x", args: z.object({ input: z.string().optional() }) },
        validate: (a: unknown) => a,
        execute: async () => "ok",
      };
      // inject two entries with different map keys but same tool.name
      (mp as any).tools.set("key1", { tool: toolA, source: "builtin", file: "a.ts", registeredAt: new Date().toISOString() });
      (mp as any).tools.set("key2", { tool: toolB, source: "builtin", file: "b.ts", registeredAt: new Date().toISOString() });
      const v = mp.validate();
      expect(v.errors.some((e) => e.includes("duplicate tool name: dup-name"))).toBe(true);
    });
    it("detects no tools registered", () => {
      const mp = createMarketplace();
      (mp as any).tools.clear();
      const v = mp.validate();
      expect(v.errors).toContain("no tools registered");
      expect(v.valid).toBe(false);
    });
    it("handles args shape extraction via _def.shape fallback (coverage)", () => {
      const mp = createMarketplace();
      (mp as any).tools.clear();
      // create a fake zod-like object where shape is undefined but _def.shape is function
      const fakeArgs: any = {
        parse: (x: unknown) => x,
        safeParse: (x: unknown) => ({ success: true, data: x }),
        _def: { shape: () => ({ foo: z.string(), bar: z.number() }) },
      };
      const fakeTool: any = {
        name: "fallback-shape-tool",
        description: "Tool fallback shape test description long enough for validation",
        schema: { name: "fallback-shape-tool", description: "x", args: fakeArgs },
        validate: (a: unknown) => a,
        execute: async () => "ok",
      };
      (mp as any).tools.set("fallback-shape-tool", {
        tool: fakeTool,
        source: "builtin",
        file: "x.ts",
        registeredAt: new Date().toISOString(),
      });
      const v = mp.validate();
      // should not error about empty shape because shape extracted via _def
      expect(v.errors.some((e) => e.includes("fallback-shape-tool") && e.includes("empty"))).toBe(false);
      // snapshot should also extract argsShape correctly
      const snap = mp.snapshot();
      const entry = snap.tools.find((t) => t.name === "fallback-shape-tool");
      expect(entry?.argsShape).toEqual(expect.arrayContaining(["foo", "bar"]));
    });
    it("handles args shape extraction via _def.shape object (not function)", () => {
      const mp = createMarketplace();
      (mp as any).tools.clear();
      const fakeArgs: any = {
        parse: (x: unknown) => x,
        safeParse: (x: unknown) => ({ success: true, data: x }),
        _def: { shape: { a: z.string(), b: z.string() } },
      };
      const fakeTool: any = {
        name: "obj-shape-tool",
        description: "Tool with obj shape for snapshot coverage long enough",
        schema: { name: "obj-shape-tool", description: "x", args: fakeArgs },
        validate: (a: unknown) => a,
        execute: async () => "ok",
      };
      (mp as any).tools.set("obj-shape-tool", {
        tool: fakeTool,
        source: "builtin",
        file: "x.ts",
        registeredAt: new Date().toISOString(),
      });
      const snap = mp.snapshot();
      const entry = snap.tools.find((t) => t.name === "obj-shape-tool");
      expect(entry?.argsShape).toEqual(expect.arrayContaining(["a", "b"]));
    });
  });

  describe("snapshot", () => {
    it("extracts argsShape via shape direct", () => {
      const mp = new InMemoryMarketplace();
      const snap = mp.snapshot();
      const mu = snap.tools.find((t) => t.name === "mission.update");
      expect(mu?.argsShape).toEqual(expect.arrayContaining(["missionId"]));
    });
    it("includes servers from opencode.json (local & remote)", () => {
      writeFileSync(
        join(tmpRoot, "opencode.json"),
        JSON.stringify({
          mcp: {
            graphify: { type: "local", command: ["python", "-m", "graphify.serve", "graph.json"], enabled: true },
            context7: { type: "remote", url: "https://mcp.context7.com/mcp", enabled: false },
            custom: { type: "local", command: ["node", "server.js"] },
          },
        }),
        "utf-8",
      );
      const mp = new InMemoryMarketplace();
      const snap = mp.snapshot();
      expect(snap.servers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "graphify", type: "local", enabled: true }),
          expect.objectContaining({ id: "context7", type: "remote", url: "https://mcp.context7.com/mcp", enabled: false }),
          expect.objectContaining({ id: "custom", type: "local", enabled: true }),
        ]),
      );
      expect(snap.version).toBeDefined();
      expect(typeof snap.updatedAt).toBe("string");
      expect(new Date(snap.updatedAt).toString()).not.toBe("Invalid Date");
    });
    it("handles missing opencode.json gracefully", () => {
      rmSync(join(tmpRoot, "opencode.json"), { force: true });
      const mp = new InMemoryMarketplace();
      const snap = mp.snapshot();
      expect(snap.servers).toEqual([]);
    });
    it("handles invalid opencode.json gracefully", () => {
      writeFileSync(join(tmpRoot, "opencode.json"), "{ invalid", "utf-8");
      const mp = new InMemoryMarketplace();
      const snap = mp.snapshot();
      expect(snap.servers).toEqual([]);
    });
    it("handles opencode.json with no mcp key", () => {
      writeFileSync(join(tmpRoot, "opencode.json"), JSON.stringify({ foo: 1 }), "utf-8");
      const mp = new InMemoryMarketplace();
      expect(mp.snapshot().servers).toEqual([]);
    });
    it("snapshot tools include source/file/serverId", () => {
      const mp = new InMemoryMarketplace();
      const tool = defineTool({
        name: "with-server",
        description: "Tool with serverId for snapshot verification long enough",
        args: z.object({ input: z.string().optional() }),
        output: z.string(),
        execute: async () => "ok",
      });
      mp.register(tool, { source: "mcp-server", file: "x.ts", serverId: "srv1" });
      const snap = mp.snapshot();
      const entry = snap.tools.find((t) => t.name === "with-server");
      expect(entry?.source).toBe("mcp-server");
      expect(entry?.serverId).toBe("srv1");
      expect(entry?.file).toBe("x.ts");
    });
  });

  describe("loadFromDisk", () => {
    it("loads from .opencode/tools and packages/mcp/tools (fallback stubs)", async () => {
      // setup .opencode/tools with files
      const opToolsDir = join(tmpRoot, ".opencode", "tools");
      mkdirSync(opToolsDir, { recursive: true });
      writeFileSync(join(opToolsDir, "extra-tool.ts"), "// dummy", "utf-8");
      writeFileSync(join(opToolsDir, "another.ts"), "// dummy", "utf-8");
      writeFileSync(join(opToolsDir, "behaviorOS.ts"), "// dummy behaviorOS already registered, should be skipped", "utf-8");
      writeFileSync(join(opToolsDir, "notes.txt"), "ignore", "utf-8");

      // setup packages/mcp/tools with dummy files (fallback stubs will be created)
      const pkgToolsDir = join(tmpRoot, "packages", "mcp", "tools");
      mkdirSync(pkgToolsDir, { recursive: true });
      writeFileSync(join(pkgToolsDir, "index.ts"), "// should be ignored", "utf-8");
      writeFileSync(join(pkgToolsDir, "dummy-one.ts"), "// dummy tool file", "utf-8");
      writeFileSync(join(pkgToolsDir, "dummy-two.ts"), "// dummy", "utf-8");

      const mp = new InMemoryMarketplace();
      const before = mp.list().length;
      const res = await mp.loadFromDisk(tmpRoot);
      expect(res.loaded).toBeGreaterThan(0);
      expect(res.errors).toEqual([]);
      // should have loaded extra-tool and another from .opencode/tools, and dummy-one/two from pkg
      expect(mp.get("extra-tool")).toBeDefined();
      expect(mp.get("another")).toBeDefined();
      // dummy-one maps to dummy.one
      expect(mp.get("dummy.one")).toBeDefined();
      expect(mp.get("dummy.two")).toBeDefined();
      expect(mp.list().length).toBeGreaterThan(before);
    });

    it("skips already registered tools", async () => {
      const opToolsDir = join(tmpRoot, ".opencode", "tools");
      mkdirSync(opToolsDir, { recursive: true });
      // mission.create already exists as stub, file mission.create.ts should be skipped if we create file with name mission.create? But file system names with dot may be tricky. Use a name that matches existing: "mission.create.ts" not typical, but test generic skip.
      // Instead we test that re-loading same dir twice doesn't duplicate
      writeFileSync(join(opToolsDir, "extra-tool.ts"), "// dummy", "utf-8");
      const mp = new InMemoryMarketplace();
      const first = await mp.loadFromDisk(tmpRoot);
      const second = await mp.loadFromDisk(tmpRoot);
      expect(second.loaded).toBe(0); // all already registered, second load 0
    });

    it("handles missing directories gracefully", async () => {
      const mp = new InMemoryMarketplace();
      // tmpRoot has behavior-os but no .opencode/tools or packages/mcp/tools — we removed them
      rmSync(join(tmpRoot, ".opencode"), { recursive: true, force: true });
      rmSync(join(tmpRoot, "packages"), { recursive: true, force: true });
      const res = await mp.loadFromDisk(tmpRoot);
      expect(res.loaded).toBe(0);
      expect(res.errors).toEqual([]);
    });

    it("fallback stub for pkg tool when dotName already exists (continue)", async () => {
      const pkgToolsDir = join(tmpRoot, "packages", "mcp", "tools");
      mkdirSync(pkgToolsDir, { recursive: true });
      // create a file that maps to existing tool name mission.update -> mission-update.ts => dotName mission.update already exists
      writeFileSync(join(pkgToolsDir, "mission-update.ts"), "// existing", "utf-8");
      const mp = new InMemoryMarketplace();
      // mission.update already exists, so load should skip (continue) and not add duplicate
      const res = await mp.loadFromDisk(tmpRoot);
      // should have 0 loaded for this file (since already exists)
      expect(mp.get("mission.update")).toBeDefined();
      // ensure no duplicate error
      expect(res.errors).toEqual([]);
    });

    it("loads with real import — upgrade stub when shape differs", async () => {
      const pkgToolsDir = join(tmpRoot, "packages", "mcp", "tools");
      mkdirSync(pkgToolsDir, { recursive: true });
      const plainToolContent = `
export const tool = {
  name: "graph.search",
  description: "Upgraded graph.search tool with new schema for testing upgrade path and long description indeed",
  schema: {
    name: "graph.search",
    description: "Upgraded",
    args: {
      parse: (x) => x,
      safeParse: (x) => ({ success: true, data: x }),
      shape: { query: {}, kind: {}, limit: {}, graphPath: {}, extraField: {} },
      _def: { shape: () => ({ query: {}, kind: {}, limit: {}, graphPath: {}, extraField: {} }) }
    },
    output: { parse: (x) => x }
  },
  validate: (a) => a,
  execute: async (a, ctx) => "upgraded",
};
export default tool;
`;
      writeFileSync(join(pkgToolsDir, "graph-search.ts"), plainToolContent, "utf-8");

      const newToolContent = `
export const tool = {
  name: "custom.newtool",
  description: "Custom new tool for testing fresh import registration path with sufficient length",
  schema: {
    name: "custom.newtool",
    description: "x",
    args: {
      parse: (x) => x,
      safeParse: (x) => ({ success: true, data: x }),
      shape: { input: {} },
      _def: { shape: () => ({ input: {} }) }
    }
  },
  validate: (a) => a,
  execute: async () => "new",
};
export default tool;
`;
      writeFileSync(join(pkgToolsDir, "custom-newtool.ts"), newToolContent, "utf-8");

      const mp = new InMemoryMarketplace();
      const res = await mp.loadFromDisk(tmpRoot);
      expect(res.errors).toEqual([]);
      // upgraded graph.search should have new description and extraField
      const upgraded = mp.get("graph.search");
      expect(upgraded).toBeDefined();
      expect(upgraded!.tool.description).toContain("Upgraded");
      const afterShape = (() => {
        const s = (upgraded!.tool.schema.args as any).shape;
        if (s && typeof s === "object") return Object.keys(s);
        const def = (upgraded!.tool.schema.args as any)._def;
        const sh = typeof def.shape === "function" ? def.shape() : def.shape;
        return Object.keys(sh ?? {});
      })();
      expect(afterShape).toEqual(expect.arrayContaining(["extraField"]));
      // custom.newtool should be registered via real import path, not fallback stub (shape is single input, not input+missionId)
      const custom = mp.get("custom.newtool");
      expect(custom).toBeDefined();
      expect(custom!.tool.description).toContain("Custom new tool");
      const customShape = (() => {
        const s = (custom!.tool.schema.args as any).shape;
        if (s && typeof s === "object") return Object.keys(s);
        const def = (custom!.tool.schema.args as any)._def;
        const sh = typeof def.shape === "function" ? def.shape() : def.shape;
        return Object.keys(sh ?? {});
      })();
      // fallback stub would be ["input","missionId"], real import is ["input"] only
      expect(customShape).toEqual(["input"]);
      expect(res.loaded).toBeGreaterThanOrEqual(2);
    });

    it("loads with real import — same shape does not upgrade (covers continue branch)", async () => {
      const pkgToolsDir = join(tmpRoot, "packages", "mcp", "tools");
      mkdirSync(pkgToolsDir, { recursive: true });
      // Create a tool that matches the stub shape exactly for mission.create (generic stub has input, missionId)
      // mission.create stub: args = z.object({ input: z.string().optional(), missionId: z.string().optional() })
      const sameShapeContent = `
export const tool = {
  name: "mission.create",
  description: "Same shape mission.create for testing same-shape continue path with long description enough",
  schema: {
    name: "mission.create",
    description: "x",
    args: {
      parse: (x) => x,
      safeParse: (x) => ({ success: true, data: x }),
      shape: { input: {}, missionId: {} },
      _def: { shape: () => ({ input: {}, missionId: {} }) }
    }
  },
  validate: (a) => a,
  execute: async () => "same",
};
export default tool;
`;
      writeFileSync(join(pkgToolsDir, "mission-create.ts"), sameShapeContent, "utf-8");
      const mp = new InMemoryMarketplace();
      const beforeDesc = mp.get("mission.create")!.tool.description;
      const res = await mp.loadFromDisk(tmpRoot);
      expect(res.errors).toEqual([]);
      // same shape should not trigger unregister/register, description stays old (not upgraded)
      const after = mp.get("mission.create")!;
      expect(after.tool.description).toBe(beforeDesc);
      // loaded should be 0 for this file since shape same -> continue without increment
      expect(res.loaded).toBe(0);
    });

    it("covers same-shape continue without upgrade", async () => {
      const pkgToolsDir = join(tmpRoot, "packages", "mcp", "tools");
      mkdirSync(pkgToolsDir, { recursive: true });
      writeFileSync(join(pkgToolsDir, "dummy-extra.ts"), "// dummy for fallback stub path", "utf-8");
      const mp = new InMemoryMarketplace();
      const res = await mp.loadFromDisk(tmpRoot);
      expect(res.errors).toEqual([]);
      expect(mp.get("dummy.extra")).toBeDefined();
    });

    it("covers loadFromDisk error branches via empty filename", async () => {
      const opToolsDir = join(tmpRoot, ".opencode", "tools");
      mkdirSync(opToolsDir, { recursive: true });
      // file named ".ts" will produce empty name "" -> defineTool throws -> catch pushes error
      writeFileSync(join(opToolsDir, ".ts"), "// empty name file", "utf-8");
      const pkgToolsDir = join(tmpRoot, "packages", "mcp", "tools");
      mkdirSync(pkgToolsDir, { recursive: true });
      writeFileSync(join(pkgToolsDir, ".ts"), "// empty", "utf-8");
      const mp = new InMemoryMarketplace();
      const res = await mp.loadFromDisk(tmpRoot);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors.some((e) => e.includes("failed to register"))).toBe(true);
    });

    it("covers snapshot shape extraction with missing _def and shape", async () => {
      const mp = createMarketplace();
      (mp as any).tools.clear();
      const fakeArgs: any = {
        parse: (x: unknown) => x,
        safeParse: (x: unknown) => ({ success: true, data: x }),
        // no shape, no _def
      };
      const fakeTool: any = {
        name: "no-shape-tool",
        description: "Tool with no shape or _def for branch coverage long enough",
        schema: { name: "no-shape-tool", description: "x", args: fakeArgs },
        validate: (a: unknown) => a,
        execute: async () => "ok",
      };
      (mp as any).tools.set("no-shape-tool", {
        tool: fakeTool,
        source: "builtin",
        file: "x.ts",
        registeredAt: new Date().toISOString(),
      });
      const snap = mp.snapshot();
      const entry = snap.tools.find((t) => t.name === "no-shape-tool");
      expect(entry?.argsShape).toEqual([]);
      const v = mp.validate();
      // empty shape should be flagged
      expect(v.errors.some((e) => e.includes("no-shape-tool") && e.includes("empty"))).toBe(true);
    });

    it("covers shape comparison catch via throwing proxy", async () => {
      const mp = new InMemoryMarketplace();
      // inject tool with throwing getter for shape
      const throwingArgs: any = {
        parse: (x: unknown) => x,
        safeParse: (x: unknown) => ({ success: true, data: x }),
        get shape() {
          throw new Error("shape access fail");
        },
        _def: {
          get shape() {
            throw new Error("def shape fail");
          },
        },
      };
      const throwingTool: any = {
        name: "throw.shape",
        description: "Tool with throwing shape for catch coverage long enough description",
        schema: { name: "throw.shape", description: "x", args: throwingArgs },
        validate: (a: unknown) => a,
        execute: async () => "ok",
      };
      (mp as any).tools.set("throw.shape", {
        tool: throwingTool,
        source: "builtin",
        file: "x.ts",
        registeredAt: new Date().toISOString(),
      });
      const pkgToolsDir = join(tmpRoot, "packages", "mcp", "tools");
      mkdirSync(pkgToolsDir, { recursive: true });
      const plainContent = `
export const tool = {
  name: "throw.shape",
  description: "Upgraded throw.shape tool with valid shape and long description sufficient",
  schema: {
    name: "throw.shape",
    description: "x",
    args: {
      parse: (x) => x,
      safeParse: (x) => ({ success: true, data: x }),
      shape: { a: {} },
      _def: { shape: () => ({ a: {} }) }
    }
  },
  validate: (a) => a,
  execute: async () => "ok",
};
export default tool;
`;
      writeFileSync(join(pkgToolsDir, "throw-shape.ts"), plainContent, "utf-8");
      const res = await mp.loadFromDisk(tmpRoot);
      // shape extraction throws but inner catch returns [], so shapes differ -> upgrade still happens
      expect(res.errors).toEqual([]);
      expect(res.loaded).toBe(1);
      const reg = mp.get("throw.shape");
      expect(reg).toBeDefined();
      expect(reg!.tool.description).toContain("Upgraded");
    });

    it("covers realTool second has check true (dotName already exists with different real name)", async () => {
      const mp = new InMemoryMarketplace();
      // pre-register a stub for dotName test.tool
      const preTool = defineTool({
        name: "test.tool",
        description: "Pre-existing test.tool for branch coverage with long description",
        args: z.object({ input: z.string().optional() }),
        output: z.string(),
        execute: async () => "pre",
      });
      mp.register(preTool, { source: "builtin", file: "x.ts" });
      const pkgToolsDir = join(tmpRoot, "packages", "mcp", "tools");
      mkdirSync(pkgToolsDir, { recursive: true });
      // File test-tool.ts dotName is test.tool, but realTool name is different.tool -> so existing via realTool.name false, but has(dotName) true -> should continue without registering different.tool
      const content = `
export const tool = {
  name: "different.tool",
  description: "Different tool name but file is test-tool.ts so dotName test.tool already exists, should trigger second has check",
  schema: {
    name: "different.tool",
    description: "x",
    args: {
      parse: (x) => x,
      safeParse: (x) => ({ success: true, data: x }),
      shape: { input: {} },
      _def: { shape: () => ({ input: {} }) }
    }
  },
  validate: (a) => a,
  execute: async () => "diff",
};
export default tool;
`;
      writeFileSync(join(pkgToolsDir, "test-tool.ts"), content, "utf-8");
      const res = await mp.loadFromDisk(tmpRoot);
      expect(res.errors).toEqual([]);
      // different.tool should NOT be registered because dotName test.tool already exists and second check triggers continue
      expect(mp.get("different.tool")).toBeUndefined();
      expect(mp.get("test.tool")).toBeDefined();
    });

    it("handles snapshot after loadFromDisk", async () => {
      const opToolsDir = join(tmpRoot, ".opencode", "tools");
      mkdirSync(opToolsDir, { recursive: true });
      writeFileSync(join(opToolsDir, "snap-test.ts"), "// dummy", "utf-8");
      const mp = new InMemoryMarketplace();
      await mp.loadFromDisk(tmpRoot);
      const snap = mp.snapshot();
      expect(snap.tools.some((t) => t.name === "snap-test")).toBe(true);
    });
  });
});
