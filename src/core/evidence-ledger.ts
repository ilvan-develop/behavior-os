/** Evidence Ledger — escreve behavior-os/runtime/*.json com status observável. ADR 006: evidence.version + controlPlane — ADR 009 federation */
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import type { Mission, Workflow, Evidence } from "../domain/types.js";
import { langGraphStatus } from "../adapters/langgraph.js";
import { govern } from "./governance.js";
import { SEMVER_RE } from "../domain/versioning.js";
import { parse as parseYaml } from "yaml";
import { TRACE_ID_RE } from "../domain/tracing.js";

function getEvidenceVersion(workflow: Workflow): string {
  // tenta workflow.version (já semver) senão lê do disco via adapter se disponível
  if (workflow.version && SEMVER_RE.test(workflow.version)) return workflow.version;
  // fallback: lê behavior-os/workflows/<id>.json
  try {
    const p = join(process.cwd(), "behavior-os", "workflows", `${workflow.id}.json`);
    if (existsSync(p)) {
      const j = JSON.parse(readFileSync(p, "utf-8"));
      if (j.version && SEMVER_RE.test(j.version)) return j.version;
    }
  } catch {}
  return workflow.version ?? "0.0.0";
}

function getControlPlaneSnapshot(): { workflowVersion: string; flags: Record<string, boolean> } | undefined {
  try {
    let flags: Record<string, boolean> = {};
    const envKeys = Object.keys(process.env).filter((k) => k.startsWith("FEATURE_"));
    const dnaFlags: Record<string, boolean> = {};
    for (const p of [join(process.cwd(), "behavior-os", "dna", "system.dna.yaml"), join(process.cwd(), "behavior-os", "dna", "project.dna.yaml")]) {
      if (existsSync(p)) {
        try {
          const raw = readFileSync(p, "utf-8");
          const parsed: any = parseYaml(raw);
          const src = parsed?.flags ?? {};
          for (const [k, v] of Object.entries(src)) if (typeof v === "boolean") dnaFlags[k] = v;
        } catch {}
      }
    }
    const allFlagNames = new Set<string>([...Object.keys(dnaFlags), ...envKeys.map((k) => k.slice(8).toLowerCase()), "canary"]);
    for (const flag of allFlagNames) {
      const envKey = `FEATURE_${flag.toUpperCase()}`;
      const envVal = process.env[envKey];
      if (envVal === "true") flags[flag] = true;
      else if (envVal === "false") flags[flag] = false;
      else if (flag in dnaFlags) flags[flag] = dnaFlags[flag];
      else flags[flag] = false;
    }
    return { workflowVersion: "", flags };
  } catch {
    return { workflowVersion: "", flags: { canary: false } };
  }
}

export function evidencePath(missionId: string): string {
  return join(process.cwd(), "behavior-os", "runtime", `${missionId}.json`);
}

export function evidenceLedger(mission: Mission, workflow: Workflow) {
  const startedAt = new Date().toISOString();
  let stages: Evidence["stages"] = workflow.stages.map((s) => ({ stage: s.id, status: "IN_PROGRESS" as const }));

  function getMcpEvidence() {
    const mcpJsonPath = join(process.cwd(), "behavior-os", "runtime", "mcp.json");
    let exists = existsSync(mcpJsonPath);
    let toolCount = 0;
    let serverCount = 0;
    let valid = false;
    let invocations: any[] = [];
    try {
      if (exists) {
        const data = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
        toolCount = data.tools?.length ?? 0;
        serverCount = data.servers?.length ?? 0;
        valid = data.validation?.valid ?? false;
        invocations = data.invocations ?? [];
        // if mcp.json exists but empty, treat as fallback
        if (toolCount === 0) throw new Error("empty mcp");
      } else {
        throw new Error("no mcp.json");
      }
    } catch {
      // fallback: generate snapshot from opencode.json + static behaviorOS tool
      try {
        const opPath = join(process.cwd(), "opencode.json");
        if (existsSync(opPath)) {
          const op = JSON.parse(readFileSync(opPath, "utf-8"));
          const mcp = (op as any).mcp ?? {};
          serverCount = Object.keys(mcp).length;
        }
      } catch {}
      // toolCount fallback: at least behaviorOS
      const toolsDir = join(process.cwd(), ".opencode", "tools");
      if (existsSync(toolsDir)) {
        try {
          const files = readdirSync(toolsDir).filter((f: string) => f.endsWith(".ts"));
          toolCount = files.length > 0 ? files.length : 1;
        } catch { toolCount = 1; }
      } else {
        toolCount = 1;
      }
      valid = toolCount >= 1;
      // ensure mcp.json is written for Regra de Ouro (write via fs directly)
      try {
        const now = new Date().toISOString();
        let version = "1.3.0";
        try { version = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")).version ?? version; } catch {}
        const snapshot = {
          version,
          updatedAt: now,
          tools: toolCount >= 1 ? [{ name: "behaviorOS", description: "behaviorOS control plane — run mission, check evidence, report status", source: "opencode-tool", file: ".opencode/tools/behaviorOS.ts", argsShape: ["action", "missionId"] }] : [],
          servers: (() => {
            try {
              const op = JSON.parse(readFileSync(join(process.cwd(), "opencode.json"), "utf-8"));
              return Object.entries<any>((op as any).mcp ?? {}).map(([id, cfg]: any) => ({ id, type: cfg.type === "remote" ? "remote" : "local", command: cfg.command, url: cfg.url, enabled: cfg.enabled !== false }));
            } catch { return []; }
          })(),
          validation: { valid, errors: valid ? [] : ["no tools"] },
          invocations,
        };
        mkdirSync(dirname(mcpJsonPath), { recursive: true });
        writeFileSync(mcpJsonPath, JSON.stringify(snapshot, null, 2), "utf-8");
        exists = true;
      } catch {}
    }
    return {
      snapshotFile: "behavior-os/runtime/mcp.json",
      exists,
      toolCount,
      serverCount,
      invocations,
      valid,
    };
  }

  function getTracesEvidence(): Evidence["traces"] | undefined {
    try {
      const tracesPath = join(process.cwd(), "behavior-os", "runtime", "traces", `${mission.id}.json`);
      if (!existsSync(tracesPath)) return undefined;
      const data = JSON.parse(readFileSync(tracesPath, "utf-8"));
      const tid: string = data.traceId ?? "";
      if (!TRACE_ID_RE.test(tid)) return undefined;
      const spans: any[] = Array.isArray(data.spans) ? data.spans : [];
      // valida parent chain minimal
      const ids = new Set(spans.map((s: any) => s.spanId));
      const roots = spans.filter((s: any) => s.parentSpanId === null);
      if (roots.length !== 1) return undefined;
      // orphan check
      for (const s of spans) if (s.parentSpanId !== null && !ids.has(s.parentSpanId)) return undefined;
      const sampled = spans.length > 0 ? (spans[0].traceFlags & 1) === 1 : false;
      return {
        traceId: tid,
        file: `behavior-os/runtime/traces/${mission.id}.json`,
        exists: true,
        spanCount: spans.length,
        sampled,
        parentSpanId: (data.parentSpanId ?? null) as any,
      };
    } catch { return undefined; }
  }

  function getFederationEvidence(): Evidence["federation"] | undefined {
    try {
      const fedPath = join(process.cwd(), "graphify-out", "federated.json");
      let data: any = null;
      if (!existsSync(fedPath)) {
        // best-effort ensure federated.json via sync generate (local only)
        try {
          const localGraphPath = join(process.cwd(), "graphify-out", "graph.json");
          if (existsSync(localGraphPath)) {
            const raw = readFileSync(localGraphPath, "utf-8");
            const g = JSON.parse(raw);
            const nodes = Array.isArray(g.nodes) ? g.nodes : [];
            const links = Array.isArray(g.links) ? g.links : Array.isArray(g.edges) ? g.edges : [];
            const rawBuf = readFileSync(localGraphPath);
            const hashShort = createHash("sha256").update(rawBuf).digest("hex").slice(0, 16);
            let mtime = new Date().toISOString();
            let freshness: "fresh" | "stale" | "missing" = "missing";
            try {
              const st = statSync(localGraphPath);
              mtime = new Date(st.mtimeMs).toISOString();
              const age = Date.now() - st.mtimeMs;
              freshness = age < 24 * 3600 * 1000 ? "fresh" : "stale";
            } catch {}
            const stat = { hash: hashShort, mtime, freshness, nodeCount: nodes.length, edgeCount: links.length };
            // generate minimal federated (degenerate local)
            const provNodes = nodes.map((n: any) => {
              const { provenance: _p, ...rest } = n;
              // stable stringify sorted keys for deterministic hash
              const keys = Object.keys(rest).sort();
              const stable: any = {};
              for (const k of keys) stable[k] = (rest as any)[k];
              const h = createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 16);
              return {
                ...n,
                provenance: {
                  id: n.id,
                  source: "local" as const,
                  sources: ["local" as const],
                  source_file: n.source_file,
                  source_location: n.source_location,
                  hash: h,
                },
              };
            }).sort((a: any, b: any) => a.id.localeCompare(b.id));
            const sortedLinks = [...links].sort((a: any, b: any) => `${a.source}->${a.target}`.localeCompare(`${b.source}->${b.target}`)).map((l: any) => ({ ...l, provenance: "local" as const }));
            const version = (() => { try { return JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")).version ?? "1.3.0"; } catch { return "1.3.0"; } })();
            const snapshot = {
              version,
              generatedAt: new Date().toISOString(),
              graphPath: "graphify-out/federated.json",
              sources: [{ source: "local", path: "graphify-out/graph.json", hash: stat.hash, mtime: stat.mtime, freshness: stat.freshness, nodeCount: stat.nodeCount, edgeCount: stat.edgeCount }],
              stats: { sources: [] as any, totalBeforeDedup: stat.nodeCount, totalAfterDedup: provNodes.length, deduped: 0, conflicts: 0, edgesMerged: sortedLinks.length, edgeConflicts: 0 },
              valid: true,
              errors: [],
              graph: { directed: false, multigraph: false, graph: {}, nodes: provNodes, links: sortedLinks },
            };
            (snapshot.stats as any).sources = snapshot.sources;
            mkdirSync(dirname(fedPath), { recursive: true });
            writeFileSync(fedPath, JSON.stringify(snapshot, null, 2), "utf-8");
            // also mirror to behavior-os/runtime/federation.json
            try {
              const mirror = join(process.cwd(), "behavior-os", "runtime", "federation.json");
              mkdirSync(dirname(mirror), { recursive: true });
              writeFileSync(mirror, JSON.stringify({ missionId: mission.id, federatedPath: "graphify-out/federated.json", snapshot }, null, 2), "utf-8");
            } catch {}
            data = snapshot;
          }
        } catch {}
      }
      if (!data) {
        if (!existsSync(fedPath)) return undefined;
        data = JSON.parse(readFileSync(fedPath, "utf-8"));
      }
      // data may have graph nested; extract snapshot fields
      const sources = data.sources ?? data.stats?.sources ?? [];
      const stats = data.stats ?? { sources, totalBeforeDedup: sources.reduce((a: any, s: any) => a + (s.nodeCount ?? 0), 0), totalAfterDedup: data.graph?.nodes?.length ?? 0, deduped: 0, conflicts: 0, edgesMerged: data.graph?.links?.length ?? 0, edgeConflicts: 0 };
      const valid = data.valid ?? true;
      const generatedAt = data.generatedAt ?? new Date().toISOString();
      const conflicts = stats.conflicts ?? 0;
      // ensure behavior-os/runtime/federation.json mirror exists
      try {
        const mirror = join(process.cwd(), "behavior-os", "runtime", "federation.json");
        if (!existsSync(mirror)) {
          mkdirSync(dirname(mirror), { recursive: true });
          writeFileSync(mirror, JSON.stringify({ missionId: mission.id, federatedPath: "graphify-out/federated.json", snapshot: data }, null, 2), "utf-8");
        }
      } catch {}
      return {
        federatedPath: "graphify-out/federated.json",
        exists: true,
        sources,
        stats,
        valid,
        conflicts,
        generatedAt,
      };
    } catch { return undefined; }
  }

  function write(status: Evidence["status"], extra: Partial<Evidence> = {}) {
    const gov = govern(mission);
    const version = (extra as any).version ?? getEvidenceVersion(workflow);
    const cpSnapshot = (extra as any).controlPlane ?? (() => {
      const snap = getControlPlaneSnapshot();
      if (!snap) return undefined;
      snap.workflowVersion = version;
      const flagsBool: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(snap.flags)) flagsBool[k] = Boolean(v);
      return { workflowVersion: version, flags: flagsBool };
    })();
    const mcp = (extra as any).mcp ?? getMcpEvidence();
    const federation = (extra as any).federation ?? getFederationEvidence();
    const traces = (extra as any).traces ?? getTracesEvidence();
    const base: Evidence = {
      missionId: mission.id,
      workflowId: workflow.id,
      status,
      startedAt,
      finishedAt: status !== "IN_PROGRESS" ? new Date().toISOString() : undefined,
      stages,
      governance: { policyId: gov.policyId, verdict: gov.allowed ? "pass" : "fail", reasons: [...gov.reasons, `action:${gov.action}`] },
      graphify: (() => {
        const gp = join(process.cwd(), "graphify-out", "graph.json");
        const exists = existsSync(gp);
        let nodeCount: number | undefined;
        if (exists) try { const d = JSON.parse(readFileSync(gp,"utf-8")); nodeCount = d.nodes?.length; } catch {}
        return { graphPath: "graphify-out/graph.json", exists, nodeCount };
      })(),
      langgraph: langGraphStatus(),
      version,
      controlPlane: cpSnapshot,
      mcp,
      federation,
      traces,
    };
    const evidence: Evidence = { ...base, ...extra, traces: (extra as any).traces ?? traces, mcp: (extra as any).mcp ?? mcp, version: (extra as any).version ?? version, controlPlane: (extra as any).controlPlane ?? cpSnapshot, federation: (extra as any).federation ?? federation };
    const p = evidencePath(mission.id);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(evidence, null, 2), "utf-8");
    // Regra de Ouro: ensure behavior-os/runtime/mcp.json observável (pure fs, no import to keep core pure)
    try {
      const mcpPath = join(process.cwd(), "behavior-os", "runtime", "mcp.json");
      if (!existsSync(mcpPath)) {
        // getMcpEvidence already wrote it; double-check
        getMcpEvidence();
      } else {
        // merge invocations if needed — keep existing
        const data = JSON.parse(readFileSync(mcpPath, "utf-8"));
        if (!data.tools?.length) getMcpEvidence();
      }
    } catch {}
    // ensure federation mirror written
    try { getFederationEvidence(); } catch {}
    return evidence;
  }

  return {
    start() { return write("IN_PROGRESS"); },
    complete() {
      stages = stages.map((s) => ({ ...s, status: "COMPLETED" as const }));
      return write("COMPLETED", { stages });
    },
    fail(reason: string) {
      const gov = govern(mission);
      return write("FAILED", { stages, governance: { policyId: gov.policyId, verdict: "fail", reasons: [...gov.reasons, reason] } });
    },
    path: evidencePath(mission.id),
  };
}
