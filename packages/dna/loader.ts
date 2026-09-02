/** DNA Loader — lê system/project/agent/workflow .dna.yaml (ou .json) */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { AnyDna } from "./schema.js";

function parseFile(path: string): AnyDna | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf-8");
  try {
    if (path.endsWith(".yaml") || path.endsWith(".yml")) return parseYaml(raw) as AnyDna;
    return JSON.parse(raw) as AnyDna;
  } catch { return null; }
}

export function loadSystemDna(root = process.cwd()): AnyDna | null {
  return parseFile(join(root, "behavior-os", "dna", "system.dna.yaml")) ?? parseFile(join(root, "behavior-os", "dna", "system.dna.json"));
}

export function loadProjectDna(root = process.cwd()): AnyDna | null {
  return parseFile(join(root, "behavior-os", "dna", "project.dna.yaml")) ?? parseFile(join(root, "behavior-os", "dna", "project.dna.json"));
}

export function loadAgentDna(agent: string, root = process.cwd()): AnyDna | null {
  return parseFile(join(root, "behavior-os", "dna", "agents", `${agent}.dna.yaml`));
}

export function loadWorkflowDna(workflow: string, root = process.cwd()): AnyDna | null {
  return parseFile(join(root, "behavior-os", "dna", "workflows", `${workflow}.dna.yaml`));
}

export function listAgentDnas(root = process.cwd()): string[] {
  const dir = join(root, "behavior-os", "dna", "agents");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".dna.yaml")).map((f) => f.replace(".dna.yaml", ""));
}
