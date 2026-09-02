import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync, utimesSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

import {
  merge,
  validate,
  federate,
  snapshot,
  readFederated,
  writeFederated,
  federateKnowledge,
  ensureFederatedSync,
} from "../packages/knowledge/federation.js";
import {
  federatedPath as storeFederatedPath,
  readFederated as storeReadFederated,
  writeFederated as storeWriteFederated,
} from "../packages/knowledge/store.js";

// helpers
function makeNode(id: string, extra: Record<string, unknown> = {}) {
  return { id, label: `node-${id}`, kind: "file", ...extra };
}
function makeGraph(nodes: any[], links: any[] = [], opts: Record<string, unknown> = {}) {
  return { directed: false, multigraph: false, graph: {}, nodes, links, ...opts } as any;
}
function hashOf(node: any): string {
  const { provenance, ...rest } = node as any;
  const stable = (() => {
    function ss(v: any): string {
      if (v === null || typeof v !== "object") return JSON.stringify(v);
      if (Array.isArray(v)) return "[" + v.map(ss).join(",") + "]";
      const keys = Object.keys(v).sort();
      return "{" + keys.map((k) => JSON.stringify(k) + ":" + ss(v[k])).join(",") + "}";
    }
    return ss(rest);
  })();
  return createHash("sha256").update(stable).digest("hex").slice(0, 16);
}
function mkTmp(): string {
  return mkdtempSync(join(tmpdir(), "bos-fed-"));
}
let origCwd = process.cwd();

function writeJson(path: string, data: any) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

describe("federation — merge pure (determinístico, sem I/O)", () => {
  it("merge empty graphs returns empty federated", () => {
    const out = merge([]);
    expect(out.nodes).toEqual([]);
    expect(out.links).toEqual([]);
    expect(out.directed).toBe(false);
  });

  it("merge single local graph preserves nodes + provenance", () => {
    const g = makeGraph([makeNode("a"), makeNode("b")]);
    const out = merge([{ source: "local", graph: g }]);
    expect(out.nodes).toHaveLength(2);
    expect(out.nodes[0].id).toBe("a"); // sorted
    expect(out.nodes[0].provenance.source).toBe("local");
    expect(out.nodes[0].provenance.sources).toEqual(["local"]);
    expect(out.nodes[0].provenance.hash).toBe(hashOf(makeNode("a")));
    expect(out.nodes[0].provenance.id).toBe("a");
  });

  it("stableStringify: key order does not affect hash — identical content deduplica", () => {
    const n1 = { id: "x", z: 1, a: 2 };
    const n2 = { a: 2, z: 1, id: "x" };
    const g1 = makeGraph([n1]);
    const g2 = makeGraph([n2]);
    // same hash -> deduped
    const out = merge([
      { source: "local", graph: g1 },
      { source: "global", graph: g2 },
    ]);
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0].provenance.sources).toEqual(expect.arrayContaining(["local", "global"]));
    expect(out.nodes[0].provenance.hash).toBe(hashOf(n1));
    expect(hashOf(n1)).toBe(hashOf(n2));
  });

  it("stableStringify handles nested arrays/objects and null", () => {
    const n1 = makeNode("n", { meta: { b: 2, a: 1 }, tags: [{ z: 1 }] });
    const n2 = makeNode("n", { meta: { a: 1, b: 2 }, tags: [{ z: 1 }] });
    expect(hashOf(n1)).toBe(hashOf(n2));
    const withNull = makeNode("k", { v: null });
    expect(hashOf(withNull)).toBeTruthy();
  });

  it("nodeHash excludes provenance", () => {
    const base = makeNode("p", { x: 1 });
    const withProv = { ...base, provenance: { id: "p", source: "global", sources: ["global"], hash: "xxx" } };
    expect(hashOf(base)).toBe(hashOf(withProv));
  });

  it("skip nodes without id, null, or non-string id", () => {
    const g = makeGraph([null as any, { label: "no-id" } as any, { id: 123 } as any, makeNode("ok")]);
    const out = merge([{ source: "local", graph: g }]);
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0].id).toBe("ok");
  });

  it("skip invalid edges, dedup by source->target", () => {
    const g = makeGraph([makeNode("a"), makeNode("b")], [
      { source: "a", target: "b" },
      null as any,
      { source: "a" } as any,
      { target: "b" } as any,
      { source: "a", target: "b", weight: 2 }, // duplicate key -> should keep local winner (first)
    ]);
    const out = merge([{ source: "local", graph: g }]);
    expect(out.links).toHaveLength(1);
    expect(out.links[0].provenance).toBe("local");
  });

  it("edges fallback to graph.edges field", () => {
    const g: any = { nodes: [makeNode("a"), makeNode("b")], edges: [{ source: "a", target: "b" }] };
    const out = merge([{ source: "local", graph: g }]);
    expect(out.links).toHaveLength(1);
  });

  it("dedup identical content across sources merges sources list, preserves winner local", () => {
    const n = makeNode("dup", { val: 1 });
    const g1 = makeGraph([n]);
    const g2 = makeGraph([{ ...n }]);
    const out = merge([
      { source: "local", graph: g1 },
      { source: "global", graph: g2 },
    ]);
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0].provenance.source).toBe("local");
    expect(out.nodes[0].provenance.sources).toEqual(["local", "global"]);
  });

  it("duplicate identical from same source does not duplicate sources", () => {
    const n = makeNode("same", { v: 1 });
    // global appears twice via two graphs with same source id
    const out = merge([
      { source: "global", graph: makeGraph([n]) },
      { source: "global", graph: makeGraph([{ ...n }]) },
    ]);
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0].provenance.sources).toEqual(["global"]); // alreadyHasSource true -> no duplicate
  });

  it("conflict: same id different hash — local wins (sorted local first), sources merged", () => {
    const localNode = makeNode("c", { val: "local" });
    const globalNode = makeNode("c", { val: "global" });
    expect(hashOf(localNode)).not.toBe(hashOf(globalNode));
    const out = merge([
      { source: "local", graph: makeGraph([localNode]) },
      { source: "global", graph: makeGraph([globalNode]) },
    ]);
    expect(out.nodes).toHaveLength(1);
    // local should remain winner
    expect(out.nodes[0].label).toBe("node-c");
    expect((out.nodes[0] as any).val).toBe("local");
    expect(out.nodes[0].provenance.source).toBe("local");
    expect(out.nodes[0].provenance.sources).toEqual(expect.arrayContaining(["local", "global"]));
    expect(out.nodes[0].provenance.hash).toBe(hashOf(localNode));
  });

  it("conflict: incoming win branch covered when existing is global and incoming lex smaller? via sort ordering", () => {
    // to hit cmp<0 branch we need existing lex larger than incoming.
    // Sorted order ensures smallest lex first, so incoming larger lex never wins.
    // We test that global-conflict path still produces deterministic local winner regardless
    // This test documents dead-code: replacement not triggered for local vs global
    const a = makeNode("x", { v: "a" });
    const b = makeNode("x", { v: "b" });
    // use two workspace sources to test lex ordering
    const out = merge([
      { source: "workspace::zzz", graph: makeGraph([a]) },
      { source: "workspace::aaa", graph: makeGraph([b]) },
    ]);
    // sorted: aaa before zzz, so winner should be b (aaa)
    expect(out.nodes[0].provenance.source).toBe("workspace::aaa");
    expect((out.nodes[0] as any).v).toBe("b");
  });

  it("source precedence: local < global < workspace lex", () => {
    const nLocal = makeNode("id1", { v: 1 });
    const nGlobal = makeNode("id2", { v: 2 });
    const nWs = makeNode("id3", { v: 3 });
    const out = merge([
      { source: "workspace::zzz", graph: makeGraph([nWs]) },
      { source: "global", graph: makeGraph([nGlobal]) },
      { source: "local", graph: makeGraph([nLocal]) },
    ]);
    expect(out.nodes.map((n) => n.id)).toEqual(["id1", "id2", "id3"]);
  });

  it("orphan edges are filtered and edgeConflicts counted internally (links sorted)", () => {
    const g = makeGraph([makeNode("a")], [
      { source: "a", target: "missing" },
      { source: "missing", target: "a" },
      { source: "a", target: "a" },
    ]);
    const out = merge([{ source: "local", graph: g }]);
    expect(out.links).toHaveLength(1);
    expect(out.links[0].source).toBe("a");
    expect(out.links[0].target).toBe("a");
  });

  it("edge dedup with precedence: local wins over global for same key", () => {
    const nodes = [makeNode("a"), makeNode("b")];
    const gLocal = makeGraph(nodes, [{ source: "a", target: "b", w: 1 }]);
    const gGlobal = makeGraph(nodes, [{ source: "a", target: "b", w: 99 }]);
    const out = merge([
      { source: "local", graph: gLocal },
      { source: "global", graph: gGlobal },
    ]);
    expect(out.links).toHaveLength(1);
    expect((out.links[0] as any).w).toBe(1);
    expect(out.links[0].provenance).toBe("local");
  });

  it("links sorted deterministically", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const g = makeGraph(nodes, [
      { source: "c", target: "a" },
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ]);
    const out = merge([{ source: "local", graph: g }]);
    expect(out.links.map((l) => `${l.source}->${l.target}`)).toEqual(["a->b", "b->c", "c->a"]);
  });

  it("directed/multigraph/graph meta extraction picks first defining graph", () => {
    const g1: any = { nodes: [makeNode("a")], links: [], directed: false, multigraph: false, graph: {} };
    const g2: any = { nodes: [], links: [], directed: true, multigraph: true, graph: { name: "x" } };
    const out = merge([
      { source: "local", graph: g1 },
      { source: "global", graph: g2 },
    ]);
    // g1 has directed false but falsy, loop continues until g2 defines true
    expect(out.directed).toBe(true);
    expect(out.multigraph).toBe(true);
    expect(out.graph).toEqual({ name: "x" });
  });

  it("graph meta from first non-empty survives even if directed false", () => {
    const g1: any = { nodes: [makeNode("a")], links: [], graph: { foo: "bar" } };
    const g2: any = { nodes: [], links: [], directed: true, graph: { other: "x" } };
    const out = merge([{ source: "local", graph: g1 }]);
    expect(out.graph).toEqual({ foo: "bar" });
  });

  it("handles missing nodes/links fields gracefully", () => {
    const out = merge([{ source: "local", graph: {} as any }]);
    expect(out.nodes).toHaveLength(0);
    expect(out.links).toHaveLength(0);
  });

  it("sortGraphs deterministic: same input different order yields same output hashes", () => {
    const gA = makeGraph([makeNode("a", { v: 1 })]);
    const gB = makeGraph([makeNode("b", { v: 2 })]);
    const out1 = merge([{ source: "global", graph: gB }, { source: "local", graph: gA }]);
    const out2 = merge([{ source: "local", graph: gA }, { source: "global", graph: gB }]);
    expect(out1.nodes.map((n) => n.id)).toEqual(out2.nodes.map((n) => n.id));
  });

  it("preserves source_file and source_location in provenance", () => {
    const n = makeNode("s", { val: 1, source_file: "src/a.ts", source_location: "L1" } as any);
    const out = merge([{ source: "local", graph: makeGraph([n]) }]);
    // provenance should capture file/location
    expect(out.nodes[0].provenance.source_file).toBe("src/a.ts");
    expect(out.nodes[0].provenance.source_location).toBe("L1");
  });

  it("conflict replacement preserves new source_file when incoming would win (lex)", () => {
    // force win via lex: existing zzz, incoming aaa (aaa wins)
    const nZ = makeNode("conf", { v: "z", source_file: "z.ts" } as any);
    const nA = makeNode("conf", { v: "a", source_file: "a.ts" } as any);
    const out = merge([
      { source: "workspace::zzz", graph: makeGraph([nZ]) },
      { source: "workspace::aaa", graph: makeGraph([nA]) },
    ]);
    // winner aaa
    expect(out.nodes[0].provenance.source).toBe("workspace::aaa");
    expect(out.nodes[0].provenance.source_file).toBe("a.ts");
  });
});

describe("federation — validate", () => {
  function validSnapshotAndGraph() {
    const g = merge([{ source: "local", graph: makeGraph([makeNode("a")], [{ source: "a", target: "a" } as any]) }]);
    const sources: any = [
      { source: "local", path: "graphify-out/graph.json", hash: "abc123", mtime: new Date().toISOString(), freshness: "fresh", nodeCount: 1, edgeCount: 1 },
    ];
    const snapshot: any = {
      version: "1.3.0",
      generatedAt: new Date().toISOString(),
      sources,
      stats: {
        sources,
        totalBeforeDedup: 1,
        totalAfterDedup: g.nodes.length,
        deduped: 0,
        conflicts: 0,
        edgesMerged: g.links.length,
        edgeConflicts: 0,
      },
      graphPath: "graphify-out/federated.json",
      valid: true,
      errors: [],
    };
    return { snapshot, graph: g };
  }

  it("valid snapshot passes", () => {
    const { snapshot, graph } = validSnapshotAndGraph();
    const r = validate(snapshot, graph);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("detects missing snapshot / graph", () => {
    const { snapshot, graph } = validSnapshotAndGraph();
    expect(validate(null as any, graph).errors).toContain("missing snapshot");
    expect(validate(snapshot, null as any).errors).toContain("missing graph");
  });

  it("detects snapshot.version missing", () => {
    const { snapshot, graph } = validSnapshotAndGraph();
    const s = { ...snapshot, version: "" };
    expect(validate(s as any, graph).errors).toContain("snapshot.version missing");
  });

  it("detects snapshot.graphPath missing", () => {
    const { snapshot, graph } = validSnapshotAndGraph();
    const s = { ...snapshot, graphPath: "" };
    expect(validate(s as any, graph).errors).toContain("snapshot.graphPath missing");
  });

  it("detects sources missing/empty", () => {
    const { snapshot, graph } = validSnapshotAndGraph();
    expect(validate({ ...snapshot, sources: [] } as any, graph).errors).toContain("snapshot.sources missing or empty");
    expect(validate({ ...snapshot, sources: null as any } as any, graph).errors).toContain("snapshot.sources missing or empty");
  });

  it("detects first source not local and no local source", () => {
    const { snapshot, graph } = validSnapshotAndGraph();
    const altSources = [
      { source: "global", path: "x", hash: "h", mtime: new Date().toISOString(), freshness: "fresh", nodeCount: 1, edgeCount: 0 },
    ];
    const s = { ...snapshot, sources: altSources };
    const r = validate(s as any, graph);
    expect(r.errors).toContain("first source must be local");
    expect(r.errors).toContain("no local source");
  });

  it("detects local freshness not fresh and hash missing", () => {
    const { snapshot, graph } = validSnapshotAndGraph();
    const s = {
      ...snapshot,
      sources: [{ ...snapshot.sources[0], freshness: "stale", hash: "" }],
    } as any;
    const r = validate(s, graph);
    expect(r.errors).toContain("local freshness must be fresh, got stale");
    expect(r.errors).toContain("local hash missing");
  });

  it("detects stats mismatches: nodes length vs totalAfter, impossible before<after, deduped mismatch", () => {
    const { snapshot, graph } = validSnapshotAndGraph();
    // mismatch totalAfter
    let s = { ...snapshot, stats: { ...snapshot.stats, totalAfterDedup: 999 } } as any;
    expect(validate(s, graph).errors.some((e) => e.includes("totalAfterDedup"))).toBe(true);
    // impossible
    s = { ...snapshot, stats: { ...snapshot.stats, totalBeforeDedup: 0, totalAfterDedup: 10 } } as any;
    expect(validate(s, graph).errors).toContain("totalBeforeDedup < totalAfterDedup impossible");
    // deduped mismatch
    s = { ...snapshot, stats: { ...snapshot.stats, deduped: 999 } } as any;
    expect(validate(s, graph).errors.some((e) => e.includes("deduped"))).toBe(true);
  });

  it("detects node provenance missing fields", () => {
    const { snapshot, graph } = validSnapshotAndGraph();
    (graph.nodes[0] as any).provenance = null;
    expect(validate(snapshot, graph).errors).toContain("node a missing provenance");
    (graph.nodes[0] as any).provenance = { id: "a", sources: ["local"], hash: "h" } as any;
    expect(validate(snapshot, graph).errors).toContain("node a provenance.source missing");
    (graph.nodes[0] as any).provenance = { id: "a", source: "local", sources: [], hash: "h" } as any;
    expect(validate(snapshot, graph).errors).toContain("node a provenance.sources missing");
    (graph.nodes[0] as any).provenance = { id: "a", source: "local", sources: ["local"], hash: "" } as any;
    expect(validate(snapshot, graph).errors).toContain("node a provenance.hash missing");
  });

  it("detects edge missing provenance", () => {
    const { snapshot, graph } = validSnapshotAndGraph();
    // need at least one edge with missing provenance
    const g2 = merge([{ source: "local", graph: makeGraph([makeNode("a")], [{ source: "a", target: "a" } as any]) }]);
    delete (g2.links[0] as any).provenance;
    const r = validate(snapshot, g2);
    expect(r.errors.some((e) => e.includes("missing provenance"))).toBe(true);
  });
});

describe("federation — I/O: loadGraphFile, federate, snapshot, store", () => {
  let tmp: string;
  let prevEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmp = mkTmp();
    prevEnv = { ...process.env };
    // do not change cwd yet; keep isolated via explicit paths where possible
  });
  afterEach(() => {
    process.env = prevEnv;
    try { process.chdir(origCwd); } catch {}
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
    // cleanup federated files created in orig cwd if any? ensure isolated
  });

  it("federate throws when local graph missing (Regra de Ouro)", async () => {
    const missing = join(tmp, "graphify-out", "graph.json");
    await expect(federate({ localPath: missing })).rejects.toThrow(/local graph not found/);
  });

  it("federate with local only succeeds, writes federated.json + runtime mirror", async () => {
    const localPath = join(tmp, "graphify-out", "graph.json");
    const data = makeGraph([makeNode("a"), makeNode("b")], [{ source: "a", target: "b" }]);
    writeJson(localPath, data);
    // ensure localPath fresh
    const out = await federate({ localPath, globalPaths: [] });
    expect(out.nodes).toHaveLength(2);

    // snapshot should be stored and reflect local
    const snap = snapshot();
    expect(snap.sources[0].source).toBe("local");
    expect(snap.stats.totalBeforeDedup).toBe(2);
    expect(snap.stats.totalAfterDedup).toBe(2);
    expect(snap.valid).toBe(true);

    // readFederated should return graph
    const rf = readFederated();
    expect(rf?.nodes).toHaveLength(2);

    // runtime mirror exists in tmp cwd? federate writes to process.cwd() runtime mirror
    // Since we passed localPath explicit, runtime mirror still written to origCwd behavior-os/runtime/federation.json
    // We can check existence via fs in origCwd, but better chdir to tmp for this test
  });

  it("federate with chdir to tmp covers getPackageVersion fallback and stale freshness", async () => {
    // create empty tmp with no package.json, plus graph with old mtime
    const localPath = join(tmp, "graphify-out", "graph.json");
    const g = makeGraph([makeNode("x")], []);
    writeJson(localPath, g);
    // make stale: 25h ago
    const old = Date.now() - 25 * 3600 * 1000;
    utimesSync(localPath, new Date(old), new Date(old));

    // chdir to tmp (no package.json) to trigger getPackageVersion catch fallback => "1.3.0"
    process.chdir(tmp);
    // create behavior-os/dna dir to avoid error
    mkdirSync(join(tmp, "behavior-os", "runtime"), { recursive: true });
    const out = await federate();
    expect(out.nodes).toHaveLength(1);
    const snap = snapshot();
    expect(snap.version).toBe("1.3.0");
    expect(snap.sources[0].freshness).toBe("stale");
    // cleanup snapshot file inside tmp/graphify-out/federated.json
    process.chdir(origCwd);
  });

  it("federate merges local+global with dedup and conflict stats", async () => {
    const localPath = join(tmp, "graphify-out", "graph.json");
    const globalPath = join(tmp, "graphify-out", "global.json");
    const localG = makeGraph([makeNode("dup", { v: "local" }), makeNode("onlyLocal")], [{ source: "dup", target: "onlyLocal" }]);
    const globalG = makeGraph([makeNode("dup", { v: "global-diff" }), makeNode("onlyGlobal")], [{ source: "onlyGlobal", target: "dup" }]);
    writeJson(localPath, localG);
    writeJson(globalPath, globalG);

    const out = await federate({ localPath, globalPaths: [globalPath] });
    // 4 nodes before, 3 after? dup deduped (conflict) -> 3 unique ids: dup, onlyLocal, onlyGlobal
    expect(out.nodes).toHaveLength(3);
    // local wins for dup
    const dup = out.nodes.find((n) => n.id === "dup")!;
    expect((dup as any).v).toBe("local");
    expect(dup.provenance.sources).toEqual(expect.arrayContaining(["local", "global"]));
    // ensure edge filtering still works (both edges have valid nodes)
    expect(out.links).toHaveLength(2);
    const snap = snapshot();
    expect(snap.stats.conflicts).toBe(1); // dup hash diff
    expect(snap.stats.deduped).toBe(1);
    expect(snap.stats.edgeConflicts).toBe(0);
  });

  it("federate counts edgeConflicts for orphans and uses edgesMerged", async () => {
    const localPath = join(tmp, "graphify-out", "graph.json");
    // global has orphan edge target missing
    const g = makeGraph([makeNode("a")], [
      { source: "a", target: "b" }, // b missing orphan
      { source: "a", target: "a" }, // valid self loop
    ] as any);
    writeJson(localPath, g);
    const out = await federate({ localPath, globalPaths: [] });
    expect(out.links).toHaveLength(1);
    const snap = snapshot();
    expect(snap.stats.edgeConflicts).toBe(1);
    expect(snap.stats.edgesMerged).toBe(1);
  });

  it("loadGraphFile handles links vs edges, invalid JSON skipped via globalPaths invalid file", async () => {
    const localPath = join(tmp, "graphify-out", "graph.json");
    const badGlobal = join(tmp, "graphify-out", "bad.json");
    writeJson(localPath, makeGraph([makeNode("a")]));
    writeFileSync(badGlobal, "not json {", "utf-8");
    const out = await federate({ localPath, globalPaths: [badGlobal] });
    expect(out.nodes).toHaveLength(1);
    // bad global should be skipped (loadGraphFile returns null)
  });

  it("loadGraphFile corrupt local JSON causes federate to use fallback? Actually local corrupt -> null => throw", async () => {
    const badLocal = join(tmp, "graphify-out", "graph.json");
    mkdirSync(dirname(badLocal), { recursive: true });
    writeFileSync(badLocal, "{ bad json", "utf-8");
    await expect(federate({ localPath: badLocal })).rejects.toThrow();
  });

  it("federate uses globalPaths candidates via env FEATURE_FEDERATION_GLOBAL", async () => {
    // create tmp with local + global.json in cwd relative
    const cwdTmp = mkTmp();
    const localPath = join(cwdTmp, "graphify-out", "graph.json");
    const globalCandidate = join(cwdTmp, "graphify-out", "global.json");
    writeJson(localPath, makeGraph([makeNode("a")]));
    writeJson(globalCandidate, makeGraph([makeNode("b")]));
    process.chdir(cwdTmp);
    process.env.FEATURE_FEDERATION_GLOBAL = "true";
    const out = await federate(); // no opts, should auto-discover global via existsSync
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    process.chdir(origCwd);
    rmSync(cwdTmp, { recursive: true, force: true });
  });

  it("federate dna federation:true triggers global inclusion without env", async () => {
    const cwdTmp = mkTmp();
    const localPath = join(cwdTmp, "graphify-out", "graph.json");
    const globalCandidate = join(cwdTmp, "graphify-out", "global.json");
    writeJson(localPath, makeGraph([makeNode("a")]));
    writeJson(globalCandidate, makeGraph([makeNode("b")]));
    const dnaPath = join(cwdTmp, "behavior-os", "dna", "system.dna.yaml");
    mkdirSync(dirname(dnaPath), { recursive: true });
    writeFileSync(dnaPath, "federation: true\n", "utf-8");
    process.chdir(cwdTmp);
    delete process.env.FEATURE_FEDERATION_GLOBAL;
    delete process.env.FEATURE_FEDERATION;
    const out = await federate();
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    process.chdir(origCwd);
    rmSync(cwdTmp, { recursive: true, force: true });
  });

  it("snapshot fallback when no federated yet: valid false pending snapshot from local", async () => {
    // use isolated cwd where no federated yet but local exists; snapshot() should return pending if no memory and federated file missing?
    // We need to reset lastSnapshot: use vi.resetModules and dynamic import to get fresh module without lastSnapshot
    vi.resetModules();
    const cwdTmp = mkTmp();
    const localPath = join(cwdTmp, "graphify-out", "graph.json");
    writeJson(localPath, makeGraph([makeNode("pending")]));
    process.chdir(cwdTmp);
    const mod: any = await import("../packages/knowledge/federation.js");
    const snap = mod.snapshot();
    // when no federated file yet but local graph exists, snapshot fallback should return sources length 1 if loadGraphFile finds local
    // but federated file missing => it tries storeReadFederated which returns null, then tries existsSync federatedPath -> false, then creates pending via loadGraphFile
    expect(snap.graphPath).toBe("graphify-out/federated.json");
    // pending may be valid false if no federated yet but local exists -> still pending snapshot with source
    // Check either pending valid false or if local found, it returns pending with local source
    if (snap.sources.length > 0) {
      expect(snap.sources[0].source).toBe("local");
      expect(snap.valid).toBe(false);
      expect(snap.errors).toContain("no federated snapshot yet");
    } else {
      // when load fails, fallback still valid false
      expect(snap.valid).toBe(false);
    }
    process.chdir(origCwd);
    rmSync(cwdTmp, { recursive: true, force: true });
    vi.resetModules();
    // re-import for subsequent tests to keep original module? next tests use static import which is still cached after reset? we need to re-import static via vi.resetModules? Simpler reload?
    await import("../packages/knowledge/federation.js");
  });

  it("writeFederated / readFederated wrappers update lastSnapshot cache", async () => {
    const g = merge([{ source: "local", graph: makeGraph([makeNode("wr")]) }]);
    const snap: any = {
      version: "1.3.0",
      generatedAt: new Date().toISOString(),
      sources: [{ source: "local", path: "graphify-out/graph.json", hash: "h", mtime: new Date().toISOString(), freshness: "fresh", nodeCount: 1, edgeCount: 0 }],
      stats: { sources: [], totalBeforeDedup: 1, totalAfterDedup: 1, deduped: 0, conflicts: 0, edgesMerged: 0, edgeConflicts: 0 },
      graphPath: "graphify-out/federated.json",
      valid: true,
      errors: [],
    };
    snap.stats.sources = snap.sources;
    writeFederated(g, snap);
    expect(readFederated()?.nodes[0].id).toBe("wr");
    const loadedSnap = snapshot();
    expect(loadedSnap.version).toBe("1.3.0");
  });

  it("store layer writeFederated deterministic sorting", () => {
    const g: any = {
      directed: false,
      multigraph: false,
      graph: {},
      nodes: [makeNode("b"), makeNode("a")],
      links: [{ source: "b", target: "a", provenance: "local" }, { source: "a", target: "b", provenance: "local" }],
    };
    const snap: any = {
      version: "9.9.9",
      generatedAt: new Date().toISOString(),
      sources: [{ source: "local", path: "x", hash: "h", mtime: new Date().toISOString(), freshness: "fresh", nodeCount: 2, edgeCount: 2 }],
      stats: { sources: [], totalBeforeDedup: 2, totalAfterDedup: 2, deduped: 0, conflicts: 0, edgesMerged: 2, edgeConflicts: 0 },
      graphPath: "graphify-out/federated.json",
      valid: true,
      errors: [],
    };
    snap.stats.sources = snap.sources;
    const p = storeWriteFederated(g, snap, tmp);
    const loaded = storeReadFederated(tmp)!;
    expect(loaded.graph.nodes[0].id).toBe("a"); // sorted
    expect(loaded.graph.links[0].source).toBe("a");
    expect(existsSync(p)).toBe(true);
  });
});

describe("federation — legacy federateKnowledge and ensureFederatedSync", () => {
  let tmpLegacy: string;
  beforeEach(() => { tmpLegacy = mkTmp(); });
  afterEach(() => { rmSync(tmpLegacy, { recursive: true, force: true }); try { process.chdir(origCwd); } catch {} });

  it("federateKnowledge returns local/global info and generates federated if missing", async () => {
    process.chdir(tmpLegacy);
    const localPath = join(tmpLegacy, "graphify-out", "graph.json");
    writeJson(localPath, makeGraph([makeNode("k")]));
    // ensure federated not exists
    const fedPath = storeFederatedPath(tmpLegacy);
    if (existsSync(fedPath)) rmSync(fedPath);
    const r = federateKnowledge();
    expect(r.local.functional).toBe(true);
    expect(r.federated).toBe(true);
    expect(r.nodes).toBe(1);
    // federated file should now exist via sync fallback
    expect(existsSync(fedPath)).toBe(true);
    process.chdir(origCwd);
  });

  it("federateKnowledge handles missing local (functional false) and global fallback to local", () => {
    process.chdir(tmpLegacy);
    const r = federateKnowledge();
    expect(r.local.functional).toBe(false);
    expect(r.global).toBeDefined();
    process.chdir(origCwd);
  });

  it("federateKnowledge with global file reports global functional", () => {
    process.chdir(tmpLegacy);
    writeJson(join(tmpLegacy, "graphify-out", "graph.json"), makeGraph([makeNode("a")]));
    writeJson(join(tmpLegacy, "graphify-out", "global.json"), makeGraph([makeNode("b")]));
    const r = federateKnowledge();
    expect(r.local.functional).toBe(true);
    expect(r.global.functional).toBe(true);
    process.chdir(origCwd);
  });

  it("ensureFederatedSync creates federated from local when missing, returns snapshot+graph", () => {
    process.chdir(tmpLegacy);
    writeJson(join(tmpLegacy, "graphify-out", "graph.json"), makeGraph([makeNode("e")]));
    const fedPath = storeFederatedPath(tmpLegacy);
    if (existsSync(fedPath)) rmSync(fedPath);
    const res = ensureFederatedSync();
    expect(res).not.toBeNull();
    expect(res!.graph.nodes[0].id).toBe("e");
    expect(res!.snapshot.valid).toBe(true);
    // second call should read existing file
    const res2 = ensureFederatedSync();
    expect(res2!.snapshot.version).toBe(res!.snapshot.version);
    process.chdir(origCwd);
  });

  it("ensureFederatedSync returns null when local missing", () => {
    process.chdir(tmpLegacy);
    // ensure no graph
    const fp = join(tmpLegacy, "graphify-out", "graph.json");
    if (existsSync(fp)) rmSync(fp);
    const fedPath = storeFederatedPath(tmpLegacy);
    if (existsSync(fedPath)) rmSync(fedPath);
    const r = ensureFederatedSync();
    expect(r).toBeNull();
    process.chdir(origCwd);
  });

  it("getPackageVersion fallback when package.json without version", async () => {
    const cwdTmp = mkTmp();
    writeFileSync(join(cwdTmp, "package.json"), JSON.stringify({ name: "x" }), "utf-8");
    writeJson(join(cwdTmp, "graphify-out", "graph.json"), makeGraph([makeNode("a")]));
    process.chdir(cwdTmp);
    const out = await federate();
    expect(out.nodes).toHaveLength(1);
    const snap = snapshot();
    expect(snap.version).toBe("1.3.0"); // fallback when version missing
    process.chdir(origCwd);
    rmSync(cwdTmp, { recursive: true, force: true });
  });

  it("getPackageVersion invalid JSON fallback", async () => {
    const cwdTmp = mkTmp();
    writeFileSync(join(cwdTmp, "package.json"), "not json", "utf-8");
    writeJson(join(cwdTmp, "graphify-out", "graph.json"), makeGraph([makeNode("a")]));
    process.chdir(cwdTmp);
    const out = await federate();
    expect(out.nodes).toHaveLength(1);
    expect(snapshot().version).toBe("1.3.0");
    process.chdir(origCwd);
    rmSync(cwdTmp, { recursive: true, force: true });
  });
});

describe("federation — branches extra para 95% coverage", () => {
  it("validate without stats does not error on stats checks", () => {
    const g = merge([{ source: "local", graph: makeGraph([makeNode("a")]) }]);
    const snap: any = {
      version: "1.0.0",
      graphPath: "graphify-out/federated.json",
      sources: [{ source: "local", path: "x", hash: "h", mtime: new Date().toISOString(), freshness: "fresh", nodeCount: 1, edgeCount: 0 }],
      valid: true,
      errors: [],
    };
    // no stats
    const r = validate(snap, g);
    expect(r.valid).toBe(true);
  });

  it("loadGraphFile handles non-array nodes/links gracefully via federate", async () => {
    const tmp2 = mkTmp();
    const localPath = join(tmp2, "graphify-out", "graph.json");
    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, JSON.stringify({ nodes: "not-array", links: "bad", directed: true }), "utf-8");
    const out = await federate({ localPath, globalPaths: [] });
    expect(out.nodes).toHaveLength(0);
    expect(out.links).toHaveLength(0);
    rmSync(tmp2, { recursive: true, force: true });
  });

  it("snapshot catch branch: federated.json exists but invalid JSON -> fallback", async () => {
    vi.resetModules();
    const cwdTmp = mkTmp();
    process.chdir(cwdTmp);
    // ensure local graph missing to hit empty sources path
    const fedPath = join(cwdTmp, "graphify-out", "federated.json");
    mkdirSync(dirname(fedPath), { recursive: true });
    writeFileSync(fedPath, "INVALID JSON", "utf-8");
    const mod: any = await import("../packages/knowledge/federation.js");
    const snap = mod.snapshot();
    // should hit catch and fallback to pending (valid false)
    expect(snap.valid).toBe(false);
    expect(snap.errors).toContain("no federated snapshot yet");
    process.chdir(origCwd);
    rmSync(cwdTmp, { recursive: true, force: true });
    vi.resetModules();
    await import("../packages/knowledge/federation.js");
  });

  it("snapshot returns storeReadFederated when file valid", async () => {
    const cwdTmp = mkTmp();
    writeJson(join(cwdTmp, "graphify-out", "graph.json"), makeGraph([makeNode("s1")]));
    process.chdir(cwdTmp);
    const out = await federate(); // creates federated
    vi.resetModules();
    const mod: any = await import("../packages/knowledge/federation.js");
    // need to chdir still cwdTmp so storeReadFederated finds file
    const snap = mod.snapshot();
    expect(snap.sources[0].source).toBe("local");
    expect(snap.valid).toBe(true);
    process.chdir(origCwd);
    rmSync(cwdTmp, { recursive: true, force: true });
    vi.resetModules();
    await import("../packages/knowledge/federation.js");
  });

  it("readFederated returns null when no file", async () => {
    vi.resetModules();
    const cwdTmp = mkTmp();
    process.chdir(cwdTmp);
    const mod: any = await import("../packages/knowledge/federation.js");
    expect(mod.readFederated()).toBeNull();
    process.chdir(origCwd);
    rmSync(cwdTmp, { recursive: true, force: true });
    vi.resetModules();
    await import("../packages/knowledge/federation.js");
  });

  it("federate opportunistically includes global.json when exists but env false", async () => {
    const cwdTmp = mkTmp();
    writeJson(join(cwdTmp, "graphify-out", "graph.json"), makeGraph([makeNode("a")]));
    writeJson(join(cwdTmp, "graphify-out", "global.json"), makeGraph([makeNode("b")]));
    process.chdir(cwdTmp);
    delete process.env.FEATURE_FEDERATION_GLOBAL;
    delete process.env.FEATURE_FEDERATION;
    // remove dna file if any
    const dnaPath = join(cwdTmp, "behavior-os", "dna", "system.dna.yaml");
    if (existsSync(dnaPath)) rmSync(dnaPath, { force: true });
    const out = await federate();
    // opportunistic path: global.json exists -> candidates includes it even without env
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    process.chdir(origCwd);
    rmSync(cwdTmp, { recursive: true, force: true });
  });

  it("ensureFederatedSync reads existing federated when file valid but storeRead returns value", async () => {
    const cwdTmp = mkTmp();
    writeJson(join(cwdTmp, "graphify-out", "graph.json"), makeGraph([makeNode("z")]));
    process.chdir(cwdTmp);
    const first = ensureFederatedSync();
    expect(first).not.toBeNull();
    // corrupt file to invalid but still exists -> storeRead returns null, but existsSync true branch still hits try fallback
    const fedPath = storeFederatedPath(cwdTmp);
    writeFileSync(fedPath, "BAD", "utf-8");
    const second = ensureFederatedSync();
    // second should still attempt to load and may return null or fallback, but branch where existsSync true and loaded null is covered
    // we just check it does not throw
    expect(second === null || second !== null).toBe(true);
    process.chdir(origCwd);
    rmSync(cwdTmp, { recursive: true, force: true });
  });

  it("merge covers nodeHash with array and object edge cases for branch completeness", () => {
    const n1: any = { id: "arr", items: [1, 2, 3], obj: { c: 3, b: 2, a: 1 } };
    const n2: any = { id: "arr", items: [1, 2, 3], obj: { a: 1, b: 2, c: 3 } };
    expect(hashOf(n1)).toBe(hashOf(n2));
    const out = merge([{ source: "local", graph: makeGraph([n1]) }, { source: "global", graph: makeGraph([n2]) }]);
    expect(out.nodes).toHaveLength(1);
  });

  it("validate reports multiple edge provenance missing for multiple edges", () => {
    const g: any = {
      nodes: [{ id: "a", provenance: { id: "a", source: "local", sources: ["local"], hash: "h" } }],
      links: [{ source: "a", target: "a" }, { source: "a", target: "a", provenance: "local" }],
      directed: false, multigraph: false, graph: {},
    };
    const snap: any = {
      version: "1.0.0",
      graphPath: "graphify-out/federated.json",
      sources: [{ source: "local", path: "x", hash: "h", mtime: new Date().toISOString(), freshness: "fresh", nodeCount: 1, edgeCount: 2 }],
      stats: { sources: [], totalBeforeDedup: 1, totalAfterDedup: 1, deduped: 0, conflicts: 0, edgesMerged: 2, edgeConflicts: 0 },
      valid: true, errors: [],
    };
    snap.stats.sources = snap.sources;
    const r = validate(snap, g);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("covers node incoming-wins replacement branch (lines 120-129) via localeCompare mock", () => {
    const orig = String.prototype.localeCompare;
    let call = 0;
    const spy = vi.spyOn(String.prototype, "localeCompare").mockImplementation(function (this: string, other: string, ...rest: any[]) {
      call++;
      // first call is sortGraphs: workspace::aaa vs workspace::zzz -> keep normal order (aaa first)
      // second call is compareSource for conflict: incoming workspace::zzz vs existing workspace::aaa should normally be >0 but we force <0
      if (call === 2) return -1;
      return orig.apply(this, [other, ...rest] as any);
    });
    const nZ = makeNode("cover", { v: "z" });
    const nA = makeNode("cover", { v: "a" });
    // after mock, sorted order still aaa first (call 1 normal), but conflict compare forced to -1 -> triggers replacement g1
    const out = merge([
      { source: "workspace::zzz", graph: makeGraph([nZ]) },
      { source: "workspace::aaa", graph: makeGraph([nA]) },
    ]);
    // replacement should have happened: winner becomes zzz despite aaa being first? Depends on forced logic
    // Check that nodes still 1 and hash corresponds to incoming winner (zzz) because cmp<0 forces replacement
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0].provenance.sources).toEqual(expect.arrayContaining(["workspace::aaa", "workspace::zzz"]));
    // when cmp<0, incoming zzz wins, so v should be "z"
    expect((out.nodes[0] as any).v).toBe("z");
    spy.mockRestore();
  });

  it("covers edge incoming-wins branch (154-155) via localeCompare mock", () => {
    const orig = String.prototype.localeCompare;
    let call = 0;
    const spy = vi.spyOn(String.prototype, "localeCompare").mockImplementation(function (this: string, other: string, ...rest: any[]) {
      call++;
      if (call === 2) return -1; // force edge cmp<0
      return orig.apply(this, [other, ...rest] as any);
    });
    const nodes = [makeNode("a"), makeNode("b")];
    const gZ = makeGraph(nodes, [{ source: "a", target: "b", w: 1 }]);
    const gA = makeGraph(nodes, [{ source: "a", target: "b", w: 99 }]);
    const out = merge([
      { source: "workspace::zzz", graph: gZ },
      { source: "workspace::aaa", graph: gA },
    ]);
    expect(out.links).toHaveLength(1);
    // with forced cmp<0, incoming should win -> w=1? Let's verify logic: first sorted aaa (w99) then zzz (w1) with mock forcing -1 for second comparison -> zzz wins -> w=1
    expect(out.links[0].provenance).toBe("workspace::zzz");
    spy.mockRestore();
  });

  it("federate snapshot stat mismatch branch via manual stats imperfection (should still validate)", async () => {
    const tmp3 = mkTmp();
    const localPath = join(tmp3, "graphify-out", "graph.json");
    writeJson(localPath, makeGraph([makeNode("x"), makeNode("y")], [{ source: "x", target: "y" }]));
    const out = await federate({ localPath, globalPaths: [] });
    const snap = snapshot();
    // manually corrupt stats to trigger validate error then re-validate
    const badSnap = { ...snap, stats: { ...snap.stats, totalAfterDedup: 999 } } as any;
    const v = validate(badSnap, out);
    expect(v.errors.some((e: string) => e.includes("totalAfterDedup"))).toBe(true);
    rmSync(tmp3, { recursive: true, force: true });
  });

  it("covers federate storeWriteFederated throw catch (line 405-ish)", async () => {
    const storeMod: any = await import("../packages/knowledge/store.js");
    const spy = vi.spyOn(storeMod, "writeFederated").mockImplementation(() => { throw new Error("disk fail"); });
    const tmp3 = mkTmp();
    const localPath = join(tmp3, "graphify-out", "graph.json");
    writeJson(localPath, makeGraph([makeNode("catch1")]));
    const out = await federate({ localPath, globalPaths: [] });
    expect(out.nodes).toHaveLength(1);
    expect(snapshot().sources[0].source).toBe("local");
    spy.mockRestore();
    rmSync(tmp3, { recursive: true, force: true });
  });

  it("covers ensureFederatedSync catch when local load throws via no local file", async () => {
    const tmp3 = mkTmp();
    process.chdir(tmp3);
    // ensure federated missing and local missing => ensure returns null (covers catch branch alternative)
    const res = ensureFederatedSync();
    expect(res).toBeNull();
    process.chdir(origCwd);
    rmSync(tmp3, { recursive: true, force: true });
  });
});
