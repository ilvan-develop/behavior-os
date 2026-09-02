#!/usr/bin/env tsx
/** Installer — npx behavior-os init
 * Detecta host, instala Behavior OS preservando soberania (não toca src/, package.json do host além de merge opencode.json).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";

export interface InitResult {
  host: string;
  created: string[];
  skipped: string[];
  doctor: { pass: boolean; details: string };
}

function detectHost(cwd: string) {
  return {
    hasPackageJson: existsSync(join(cwd, "package.json")),
    hasGit: existsSync(join(cwd, ".git")),
    hasPnpm: existsSync(join(cwd, "pnpm-lock.yaml")),
    hasOpencode: existsSync(join(cwd, "opencode.json")),
  };
}

export async function init(hostPath = process.cwd()): Promise<InitResult> {
  const cwd = hostPath;
  const created: string[] = [];
  const skipped: string[] = [];
  const host = detectHost(cwd);

  // 1. AGENTS.md
  if (!existsSync(join(cwd, "AGENTS.md"))) {
    const template = `# AGENTS.md — Behavior OS

> Regra persistente. Produto: Behavior OS / identificador: behavior-os / comando: npx behavior-os init

Principio: Mission → Workflow Engine → Agents → Skills → Governance → Evidence
Regra: Configuração não é integração. Evidência = behavior-os/runtime/*.json COMPLETED + graphify-out/graph.json
OpenCode nativo: .opencode/agents/*.md, .opencode/skills/*/SKILL.md, .opencode/tools/*.ts, .opencode/plugins/*.ts, mcp.graphify
`;
    writeFileSync(join(cwd, "AGENTS.md"), template, "utf-8");
    created.push("AGENTS.md");
  } else skipped.push("AGENTS.md");

  // 2. behavior-os/dna + workflows + missions (copia do template deste repo se existir)
  const templateRoot = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "../.."); // src/cli -> root
  // fallback: se rodar via tsx, templateRoot é behaviorOS root; se via dist, ajusta
  const ensureDir = (p: string) => mkdirSync(p, { recursive: true });
  const dnaFiles = [
    ["behavior-os/dna/system.dna.yaml", "behavior-os/dna/system.dna.yaml"],
    ["behavior-os/dna/project.dna.yaml", "behavior-os/dna/project.dna.yaml"],
    ["behavior-os/workflows/development.json", "behavior-os/workflows/development.json"],
    ["behavior-os/workflows/parallel.json", "behavior-os/workflows/parallel.json"],
    ["behavior-os/missions/demo.json", "behavior-os/missions/demo.json"],
    ["dnas/enterprise-governance.yaml", "dnas/enterprise-governance.yaml"],
    [".opencode/skills/behavioros/SKILL.md", ".opencode/skills/behavioros/SKILL.md"],
    [".opencode/plugins/behaviorOS.ts", ".opencode/plugins/behaviorOS.ts"],
  ] as const;
  for (const [srcRel, dstRel] of dnaFiles) {
    const dst = join(cwd, dstRel);
    if (!existsSync(dst)) {
      ensureDir(dirname(dst));
      const src = join(templateRoot, srcRel);
      if (existsSync(src)) copyFileSync(src, dst);
      else writeFileSync(dst, "{}", "utf-8");
      created.push(dstRel);
    } else skipped.push(dstRel);
  }

  // 3. .opencode/agents + skills + plugins (copia se não existir)
  const agentsSrc = join(templateRoot, ".opencode", "agents");
  const agentsDst = join(cwd, ".opencode", "agents");
  if (existsSync(agentsSrc)) {
    ensureDir(agentsDst);
    for (const f of readdirSync(agentsSrc)) {
      const dst = join(agentsDst, f);
      if (!existsSync(dst)) {
        copyFileSync(join(agentsSrc, f), dst);
        created.push(`.opencode/agents/${f}`);
      }
    }
  }
  // skills behavioros
  const skillSrc = join(templateRoot, ".opencode", "skills", "behavioros", "SKILL.md");
  const skillDst = join(cwd, ".opencode", "skills", "behavioros", "SKILL.md");
  if (existsSync(skillSrc) && !existsSync(skillDst)) {
    ensureDir(dirname(skillDst));
    copyFileSync(skillSrc, skillDst);
    created.push(".opencode/skills/behavioros/SKILL.md");
  }
  // plugin behaviorOS
  const pluginSrc = join(templateRoot, ".opencode", "plugins", "behaviorOS.ts");
  const pluginDst = join(cwd, ".opencode", "plugins", "behaviorOS.ts");
  if (existsSync(pluginSrc) && !existsSync(pluginDst)) {
    ensureDir(dirname(pluginDst));
    copyFileSync(pluginSrc, pluginDst);
    created.push(".opencode/plugins/behaviorOS.ts");
  }

  // 4. opencode.json merge (garante mcp.graphify)
  const opencodePath = join(cwd, "opencode.json");
  let opencode: any = {};
  if (existsSync(opencodePath)) {
    try { opencode = JSON.parse(readFileSync(opencodePath, "utf-8")); } catch {}
  }
  if (!opencode.$schema) opencode.$schema = "https://opencode.ai/config.json";
  if (!opencode.mcp) opencode.mcp = {};
  if (!opencode.mcp.graphify) {
    opencode.mcp.graphify = { type: "local", command: ["python", "-m", "graphify.serve", "graphify-out/graph.json"], enabled: true };
    created.push("opencode.json:mcp.graphify");
  }
  if (!opencode.instructions) opencode.instructions = ["AGENTS.md"];
  // portabilidade: garantir permission granular portável (não hardcoded Windows)
  if (!opencode.permission) opencode.permission = {};
  if (!opencode.permission.external_directory) {
    opencode.permission.external_directory = { "behavior-os/**": "allow", "graphify-out/**": "allow", ".opencode/**": "allow", "dnas/**": "allow" };
  }
  if (!opencode.permission.bash) {
    opencode.permission.bash = { "*": "ask", "git *": "allow", "npm *": "allow", "pnpm *": "allow", "npx *": "allow", "node *": "allow", "python *": "allow", "graphify *": "allow" };
  }
  // plugin scaffolder: garante behaviorOS plugin + permite outro lado-a-lado
  if (!opencode.plugin) opencode.plugin = [];
  if (Array.isArray(opencode.plugin) && !opencode.plugin.includes("./.opencode/plugins/behaviorOS.ts")) {
    opencode.plugin.unshift("./.opencode/plugins/behaviorOS.ts");
    created.push("opencode.json:plugin behaviorOS");
  }
  if (!opencode.plugins && opencode.plugin.length) opencode.plugins = opencode.plugin; // v2 compat
  writeFileSync(opencodePath, JSON.stringify(opencode, null, 2), "utf-8");

  // 5. doctor (check simples, sem importar doctor que é script)
  let doctorPass = true;
  let details = "";
  const checks = [
    existsSync(join(cwd, "AGENTS.md")),
    existsSync(join(cwd, "opencode.json")),
    existsSync(join(cwd, "behavior-os", "workflows", "development.json")),
  ];
  doctorPass = checks.every(Boolean);
  details = `AGENTS.md:${checks[0]} opencode.json:${checks[1]} workflow:${checks[2]}`;

  return { host: cwd, created, skipped, doctor: { pass: doctorPass, details } };
}

if (process.argv[1]?.endsWith("init.ts") || process.argv[1]?.endsWith("init.js") || process.argv.includes("--init")) {
  const res = await init();
  console.log(`[init] host: ${res.host}`);
  console.log(`[init] created: ${res.created.join(", ") || "(none)"}`);
  console.log(`[init] skipped: ${res.skipped.join(", ") || "(none)"}`);
  console.log(`[init] doctor: ${res.doctor.pass ? "PASS" : "FAIL"} — ${res.doctor.details}`);
  console.log(`[init] done — run pnpm doctor && pnpm demo`);
}
