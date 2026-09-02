/** OpenCode Adapter — boundary between behavior-os and OpenCode execution surface.
 * Não assume funcionalidade; verifica evidência.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface OpenCodeStatus {
  installed: boolean;
  agents: number;
  skills: number;
  configValid: boolean;
}

export function opencodeStatus(): OpenCodeStatus {
  const cwd = process.cwd();
  const configExists = existsSync(join(cwd, "opencode.json")) || existsSync(join(cwd, ".opencode", "opencode.json"));
  let agents = 0, skills = 0;
  try {
    agents = readdirSync(join(cwd, ".opencode", "agents")).length;
  } catch {}
  try {
    skills = readdirSync(join(cwd, ".opencode", "skills")).length;
  } catch {}
  return { installed: configExists, agents, skills, configValid: configExists };
}

export function validateOpenCodeConfig(path = "opencode.json"): boolean {
  try {
    const raw = readFileSync(path, "utf-8");
    const j = JSON.parse(raw);
    return !!j.$schema && j.$schema.includes("opencode.ai/config.json");
  } catch { return false; }
}
