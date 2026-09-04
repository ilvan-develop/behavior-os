import type { Plugin } from "@opencode-ai/plugin";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * behaviorOS plugin v3.6 — contrato de execução + inteligência ativa.
 *
 * Gates (hard, fail-closed):
 *   1. Protected paths — .env nunca lido/escrito (incondicional).
 *   2. Mission guard — edit/write/bash SEM missão IN_PROGRESS vigente (<24h)
 *      ESCALA: permitido + registro append-only em gate-journal.jsonl.
 *
 * Inteligência ativa (feedback loop):
 *   3. tool.execute.after — mutações fora de missão recebem no OUTPUT (que o
 *      modelo lê) um lembrete do protocolo: transforma o journal passivo em
 *      correção de rota em tempo real.
 *   4. session.idle — lê gate-journal + evidence gaps e PROPÕE a próxima
 *      missão (next-mission-proposal.json). Propõe, nunca auto-executa:
 *      decisão é do operador (human-in-the-loop).
 *
 * Self-contained: zero imports além de built-ins + @opencode-ai/plugin —
 * funciona em qualquer host (npx behavior-os init).
 */

const READ_ONLY = new Set(["read", "glob", "grep", "list", "webfetch", "websearch", "skill", "task", "todowrite", "question", "doom_loop"]);
const MUTATING = new Set(["edit", "write", "bash", "multiedit", "patch"]);
const GRAPHIFY_PREFIX = "graphify";
const MCP_GRAPHIFY = "mcp__graphify";
const PROTOCOL_REMINDER =
  "\n\n[behaviorOS] Esta mutação ocorreu SEM missão vigente e foi registrada em behavior-os/runtime/gate-journal.jsonl. " +
  "Protocolo: Discover → Plan → Execute → QA. Abra uma missão governada antes de continuar mutando: " +
  "`behavior-os mission create <id>` + `behavior-os mission run <id>` (evidence COMPLETED obrigatória).";

/** Regras de permissão por agente (canônicas — espelhadas em packages/gateway). */
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
      if (!f.endsWith(".json") || f === "mcp.json" || f === "federation.json" || f === "next-mission-proposal.json") continue;
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

interface MissionProposal {
  timestamp: string;
  title: string;
  workflowId: string;
  reason: string;
  sources: { journalViolations: number; evidenceGaps: string[] };
}

/** Evolução ativa — lê journal + evidence gaps e PROPÕE a próxima missão. */
function computeNextMissionProposal(cwd: string): MissionProposal {
  const rt = join(cwd, "behavior-os", "runtime");
  let journalViolations = 0;
  try {
    if (existsSync(join(rt, "gate-journal.jsonl"))) {
      for (const line of readFileSync(join(rt, "gate-journal.jsonl"), "utf-8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line) as JournalEntry;
          if (e.kind === "mission-guard" && e.decision === "allowed") journalViolations++;
        } catch {
          continue;
        }
      }
    }
  } catch {
    // sem journal — ok
  }
  const evidenceGaps: string[] = [];
  try {
    for (const f of readdirSync(rt)) {
      if (!f.endsWith(".json") || f === "mcp.json" || f === "federation.json" || f === "next-mission-proposal.json") continue;
      try {
        const e = JSON.parse(readFileSync(join(rt, f), "utf-8")) as { evaluator?: { approved?: boolean; feedback?: string[] }; missionId?: string };
        if (e.evaluator && e.evaluator.approved === false) {
          evidenceGaps.push(`${e.missionId ?? f}: ${e.evaluator.feedback?.[0] ?? "evaluator disapproved"}`);
        }
      } catch {
        continue;
      }
    }
  } catch {
    // sem runtime — ok
  }
  if (evidenceGaps.length > 0) {
    return {
      timestamp: new Date().toISOString(),
      title: `Fix evidence gaps: ${evidenceGaps[0]}`,
      workflowId: "bugfix",
      reason: `self-evolution: ${evidenceGaps.length} evidence(s) com evaluator reprovado`,
      sources: { journalViolations, evidenceGaps },
    };
  }
  if (journalViolations > 0) {
    return {
      timestamp: new Date().toISOString(),
      title: "Restore protocol: govern mutations through a mission",
      workflowId: "development",
      reason: `self-evolution: ${journalViolations} mutações fora de missão registradas no gate journal`,
      sources: { journalViolations, evidenceGaps },
    };
  }
  return {
    timestamp: new Date().toISOString(),
    title: "No proposal — protocol healthy",
    workflowId: "",
    reason: "self-evolution: sem gaps de evidence e sem violações de protocolo no journal",
    sources: { journalViolations, evidenceGaps },
  };
}

const BehaviorOSPlugin: Plugin = async ({ client }) => {
  await client.app.log({ body: { service: "behaviorOS", level: "info", message: "behaviorOS plugin v3.6 loaded (gates fail-closed + active intelligence: feedback loop + mission proposal)" } });
  // callIDs que escalaram no before → lembrar o modelo no after
  const pendingFeedback = new Set<string>();

  return {
    "tool.execute.before": async (input, output) => {
      const tool = input.tool;
      const sessionID = input.sessionID ?? "unknown-session";
      const cwd = process.cwd();

      // ── Gate 1: protected paths — incondicional, fail-closed ──
      const filePath = typeof output.args?.filePath === "string" ? output.args.filePath : typeof output.args?.file_path === "string" ? output.args.file_path : "";
      const command = typeof output.args?.command === "string" ? output.args.command : "";
      const targetsProtected = (p: string) => /(^|[/\\])\.env$/i.test(p.trim());
      if (
        (filePath && targetsProtected(filePath) && !filePath.endsWith(".env.example")) ||
        (command && (command.includes(" .env") || (command.includes(".env ") && command.includes("rm"))))
      ) {
        appendJournal(cwd, { ts: new Date().toISOString(), kind: "protected-path", tool, sessionID, decision: "blocked", reason: "protected path .env" });
        await client.app.log({ body: { service: "behaviorOS", level: "warn", message: "Gateway blocked protected path .env" } });
        throw new Error("Gateway blocked protected path .env");
      }

      // ── Read-only e graphify passam livres ──
      if (READ_ONLY.has(tool) || tool.startsWith(GRAPHIFY_PREFIX) || tool.startsWith(MCP_GRAPHIFY) || tool === "query_graph") {
        return;
      }

      // ── Gate 2 (mutating tools): mission guard — escalate + feedback ──
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
          pendingFeedback.add(input.callID);
          await client.app.log({
            body: { service: "behaviorOS", level: "info", message: `behaviorOS mission guard: ${tool} sem missão vigente — permitido + registrado (feedback injetado no output)` },
          });
        }
        // agent rules (bloqueio por papel)
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

    "tool.execute.after": async (input, output) => {
      // Feedback loop: mutação fora de missão → o modelo LÊ o lembrete no resultado da tool.
      if (!pendingFeedback.has(input.callID)) return;
      pendingFeedback.delete(input.callID);
      if (typeof output.output === "string" && !output.output.includes("[behaviorOS]")) {
        output.output = output.output + PROTOCOL_REMINDER;
      }
    },

    "session.idle": async () => {
      // Evolução ativa — propõe a próxima missão ao operador. NUNCA auto-executa.
      try {
        const cwd = process.cwd();
        const rt = join(cwd, "behavior-os", "runtime");
        if (!existsSync(rt)) return;
        const proposal = computeNextMissionProposal(cwd);
        const out = join(rt, "next-mission-proposal.json");
        if (existsSync(out)) {
          try {
            const prev = JSON.parse(readFileSync(out, "utf-8")) as MissionProposal;
            if (prev.title === proposal.title && prev.reason === proposal.reason) {
              await client.app.log({ body: { service: "behaviorOS", level: "info", message: `behaviorOS self-evolution: no new proposal (${proposal.reason})` } });
              return;
            }
          } catch {
            // arquivo corrompido — sobrescreve
          }
        }
        mkdirSync(rt, { recursive: true });
        writeFileSync(out, JSON.stringify(proposal, null, 2), "utf-8");
        if (proposal.workflowId) {
          await client.app.log({
            body: { service: "behaviorOS", level: "info", message: `behaviorOS self-evolution PROPOSAL: "${proposal.title}" (workflow: ${proposal.workflowId}) — ${proposal.reason}. Revise e execute: behavior-os mission create <id> + run. Nada foi executado automaticamente.` },
          });
        } else {
          await client.app.log({ body: { service: "behaviorOS", level: "info", message: `behaviorOS self-evolution: ${proposal.reason}` } });
        }
      } catch (e) {
        await client.app.log({ body: { service: "behaviorOS", level: "error", message: `behaviorOS self-evolution failed: ${String(e)}` } });
      }
    },
  };
};

export default BehaviorOSPlugin;
