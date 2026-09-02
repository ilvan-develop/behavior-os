// packages/control-plane/dna-flags.ts — DNA fallback for FeatureFlags (ADR 006)
// Lê behavior-os/dna/system.dna.yaml + project.dna.yaml → flags: Record<string, boolean>
// Se flags ausente, equivale a {} (tudo false). Cache por mtime.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

type FlagsMap = Record<string, boolean>;

let cache: { mtime: number; flags: FlagsMap } | null = null;

function loadDnaFlags(root = process.cwd()): FlagsMap {
  const files = [
    join(root, "behavior-os", "dna", "system.dna.yaml"),
    join(root, "behavior-os", "dna", "project.dna.yaml"),
  ];
  let maxMtime = 0;
  let flags: FlagsMap = {};
  for (const p of files) {
    if (!existsSync(p)) continue;
    try {
      const mtime = statSync(p).mtimeMs;
      if (mtime > maxMtime) maxMtime = mtime;
      const raw = readFileSync(p, "utf-8");
      const parsed: any = parseYaml(raw);
      // ADR 006: flags: { canary: false, useLangGraph: false }
      // Suporta também dna.flags.* e root-level flags para retrocompatibilidade
      const src = parsed?.flags ?? parsed?.features ?? {};
      if (src && typeof src === "object") {
        for (const [k, v] of Object.entries(src)) {
          if (typeof v === "boolean") flags[k] = v;
          // também suporta "true"/"false" string como boolean
          if (typeof v === "string" && (v === "true" || v === "false")) flags[k] = v === "true";
        }
      }
    } catch {}
  }
  // cache simples
  if (cache && cache.mtime === maxMtime) return cache.flags;
  cache = { mtime: maxMtime, flags };
  return flags;
}

export function getDnaFlag(flag: string, root = process.cwd()): boolean | undefined {
  const flags = loadDnaFlags(root);
  if (flag in flags) return flags[flag];
  // também tenta kebab/camel variações? mantém simples: busca exata + lower
  // suporta flag normalizado
  return undefined;
}

export function getAllDnaFlags(root = process.cwd()): FlagsMap {
  return { ...loadDnaFlags(root) };
}

export function clearDnaFlagCache() {
  cache = null;
}
