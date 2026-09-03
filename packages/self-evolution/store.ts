/** Self-Evolution Store — sole writer/reader for runtime/self-evolution.tson (Regra de Ouro)
 * Mirrors packages/knowledge/store.ts pattern for federated.json
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import type { TsonSnapshot } from "../../src/domain/self-evolution.js";

export function tsonPath(root = process.cwd()): string {
  return join(root, "behavior-os", "runtime", "self-evolution.tson");
}

export function readTson(root = process.cwd()): TsonSnapshot | null {
  const p = tsonPath(root);
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as TsonSnapshot;
    return parsed;
  } catch { return null; }
}

export function writeTson(snapshot: TsonSnapshot, root = process.cwd()): string {
  const p = tsonPath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(snapshot, null, 2), "utf-8");
  return p;
}

export function ensureTsonStat(path: string): { hash: string; mtime: string; freshness: "fresh"|"stale"|"missing" } {
  if (!existsSync(path)) return { hash: "", mtime: new Date(0).toISOString(), freshness: "missing" };
  try {
    const st = statSync(path);
    const mtime = new Date(st.mtimeMs).toISOString();
    const age = Date.now() - st.mtimeMs;
    const freshness = age < 24 * 3600 * 1000 ? "fresh" as const : "stale" as const;
    const hash = createHash("sha256").update(readFileSync(path)).digest("hex").slice(0,16);
    return { hash, mtime, freshness };
  } catch { return { hash: "", mtime: new Date(0).toISOString(), freshness: "missing" }; }
}

export function tsonFreshness(root = process.cwd()): "fresh"|"stale"|"missing" {
  return ensureTsonStat(tsonPath(root)).freshness;
}
