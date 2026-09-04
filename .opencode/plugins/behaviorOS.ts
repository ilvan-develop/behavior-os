import type { Plugin } from "@opencode-ai/plugin";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * behaviorOS plugin v3.5 — contrato de execução self-contained.
 *
 * Gates (hard, fail-closed):
 *   1. Protected paths — .env nunca lido/escrito (incondicional).
 *   2. Mission guard — edit/write/bash SEM missão IN_PROGRESS vigente (<24h)
 *      não bloqueia: ESCALA com registro append-only no audit journal
 *      behavior-os/runtime/gate-journal.jsonl (Protocolo como contrato de execução).
 *
 * Sem imports externos ao plugin — funciona em qualquer host (npx behavior-os init).
 */

const READ_ONLY = new Set(["read", "glob", "grep", "list", "webfetch", "websearch", "skill", "task", "todowrite", "question", "doom_loop"]);
const MUTATING = new Set(["edit", "write", "bash", "multiedit", "patch"]);
const GRAPHIFY_PREFIX = "graphify";
const MCP_GRAPHIFY = "mcp__graphify";

/** Regras de permissão por agente (antes no packages/gateway — agora embutidas). */
const AGENT_RULES: Record<string, { deny: string[]; reason: string }> = {
  researcher: { deny: ["bash", "write", "edit"], reason: "researcher is read-only" },
  security: { deny: ["write"], reason: "security cannot write due to DNA invariant" },
};

interface JournalEntry {
  ts: string;
  kind: "mission-guard" | "agent-gate" | "protected-path" | "gate-error";
  tool: string;
  sessionID: string;
  decision: "allowed" | "blocked";
  reason: string;
  detail?: string;
}

function appendJournal(cwd: string, entry: JournalEntry): void {
  try {
    const dir = join(cwd, "behavior-os", "runtime");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "gate-journal.jsonl"), JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // journal é best-effort: nunca deve derrubar a tool
  }
}

/** Missão vigente = evidence IN_PROGRESS com startedAt < 24h. */
function hasActiveMission(cwd: string): boolean {
  try {
    const rt = join(cwd, "behavior-os", "runtime");
    if (!existsSync(rt)) return false;
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    for (const f of readdirSync(rt)) {
      if (!f.endsWith(".json") || f === "mcp.json" || f === "federation.json") continue;
      try {
        const e = JSON.parse(readFileSync(join(rt, f), "utf-8")) as { status?: string; startedAt?: string };
        if (e.status === "IN_PROGRESS" && e.startedAt && now - new Date(e.startedAt).getTime() < day) return true;
      } catch {
        continue;
      }
    }
    return false;
  } catch {
    return false;
  }
}

const BehaviorOSPlugin: Plugin = async ({ client }) => {
  await client.app.log({ body: { service: "behaviorOS", level: "info", message: "behaviorOS plugin v3.5 loaded (self-contained, fail-closed, mission guard: escalate)" } });
  return {
    "tool.execute.before": async (input, output) => {
      const tool = input.tool;
      const sessionID = input.sessionID ?? "unknown-session";
      const cwd = process.cwd();

      // ── Gate 1: protected paths — incondicional, fail-closed ──
      const filePath = typeof output.args?.filePath === "string" ? output.args.filePath : typeof output.args?.file_path === "string" ? output.args.file_path : "";
      const command = typeof output.args?.command === "string" ? output.args.command : "";
      const targetsProtected = (p: string) =>
        p.endsWith(".env") ||
        p.includes("/.env/") ||
        p.includes("\\.env\\") ||
        (!p.endsWith(".env.example") && p.endsWith(".env.example") === false && /(^|[/\\])\.env$/i.test(p));
      if (
        (filePath && targetsProtected(filePath) && !filePath.endsWith(".env.example")) ||
        (command && (command.includes(" .env") || command.includes(".env ") && command.includes("rm")))
      ) {
        appendJournal(cwd, { ts: new Date().toISOString(), kind: "protected-path", tool, sessionID, decision: "blocked", reason: "protected path .env" });
        await client.app.log({ body: { service: "behaviorOS", level: "warn", message: "Gateway blocked protected path .env" } });
        throw new Error("Gateway blocked protected path .env");
      }

      // ── Read-only e graphify passam livres ──
      if (READ_ONLY.has(tool) || tool.startsWith(GRAPHIFY_PREFIX) || tool.startsWith(MCP_GRAPHIFY) || tool === "query_graph") {
        return;
      }      // ── Gate 2 (mutating tools): mission guard — escalate ──
      if (MUTATING.has(tool)) {
        const active = hasActiveMission(cwd);
        if (!active) {
          appendJournal(cwd, {
            ts: new Date().toISOString(),
            kind: "mission-guard",
            tool,
            sessionID,
            decision: "allowed",
            reason: "no active mission IN_PROGRESS — escalated to audit journal",
          });
          await client.app.log({
            body: { service: "behaviorOS", level: "info", message: `behaviorOS mission guard: ${tool} sem missão vigente — permitido + registrado em gate-journal.jsonl (abra uma missão: behavior-os mission run <id>)` },
          });
        }
        // agent rules (bloqueio por papel — ex.: security não escreve)
        const agent = (output.args as any)?.agent ?? (input as any).agent;
        if (agent && AGENT_RULES[agent]?.deny.includes(tool)) {
          appendJournal(cwd, { ts: new Date().toISOString(), kind: "agent-gate", tool, sessionID, decision: "blocked", reason: AGENT_RULES[agent].reason });
          await client.app.log({ body: { service: "behaviorOS", level: "warn", message: `Gateway blocked: ${AGENT_RULES[agent].reason}` } });
          throw new Error(`Gateway blocked: ${AGENT_RULES[agent].reason}`);
        }
        return;
      }

      // ── Qualquer outra tool desconhecida: fail-closed — block ──
      appendJournal(cwd, { ts: new Date().toISOString(), kind: "gate-error", tool, sessionID, decision: "blocked", reason: "unknown tool reached gate (fail-closed default)" });
      throw new Error(`Gateway blocked: unknown tool "${tool}" not in read-only or mutating allowlists`);
    },
  };
};

export default BehaviorOSPlugin;
