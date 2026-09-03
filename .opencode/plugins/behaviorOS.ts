import type { Plugin } from "@opencode-ai/plugin";

const BehaviorOSPlugin: Plugin = async ({ client }) => {
  await client.app.log({ body: { service: "behaviorOS", level: "info", message: "behaviorOS plugin loaded" } });
  return {
    "tool.execute.before": async (input, output) => {
      const tool = input.tool as string;
      // allow read-only sem gateway (desbloqueia discover/pesquisa) — edit/bash/write passam por governance
      if (["read","glob","grep","webfetch","websearch","skill","list","task","todowrite","question"].includes(tool) || tool.startsWith("graphify") || tool.startsWith("mcp__graphify") || tool==="query_graph") {
        if (tool === "read" && typeof output.args?.filePath === "string" && output.args.filePath.includes(".env")) {
          if (output.args.filePath.endsWith(".env.example")) return;
          await client.app.log({ body: { service: "behaviorOS", level: "warn", message: "Gateway blocked protected path .env" } });
          throw new Error("Gateway blocked protected path .env");
        }
        return;
      }
      try {
        const { canExecute } = await import("../../packages/gateway/gateway.ts");
        const agent = (input as any).agent ?? "orchestrator";
        const decision = canExecute(tool, agent, "development");
        if (!decision.allowed) {
          await client.app.log({ body: { service: "behaviorOS", level: "warn", message: `Gateway block: ${decision.reason}` } });
          throw new Error(`Gateway blocked: ${decision.reason}`);
        }
      } catch (e) {
        if ((e as Error).message?.startsWith("Gateway blocked")) throw e;
        await client.app.log({ body: { service: "behaviorOS", level: "warn", message: `Gateway error ignored for ${tool}: ${String(e)}` } });
      }
    },
    "session.idle": async () => {
      try {
        const { discoverSelfEvolution } = await import("../../packages/orchestrator/self-evolution.ts");
        const { canExecute } = await import("../../packages/gateway/gateway.ts");
        const discovery = discoverSelfEvolution("demo");
        const decision = canExecute("write", "orchestrator", "autonomous");
        if (!decision.allowed) {
          await client.app.log({ body: { service: "behaviorOS", level: "info", message: `Self-evolution blocked by Gateway: ${decision.reason}` } });
          return;
        }
        if (discovery.gaps.length === 0 && discovery.proposals.length === 0) {
          await client.app.log({ body: { service: "behaviorOS", level: "info", message: `Self-evolution: no gaps (coverage ${discovery.coverage.global}%)` } });
          return;
        }
        const { writeFileSync, mkdirSync, existsSync } = await import("node:fs");
        const { join, dirname } = await import("node:path");
        const out = join(process.cwd(), "behavior-os", "runtime", "self-evolution.json");
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, JSON.stringify({ timestamp: new Date().toISOString(), discovery, gateway: decision }, null, 2), "utf-8");
        await client.app.log({ body: { service: "behaviorOS", level: "info", message: `Self-evolution discovery written to ${out} with ${discovery.proposals.length} proposals` } });
        for (const p of discovery.proposals) {
          if (!p) continue;
          if ((p as any).kind === "new-skill" && (p as any).dnaPatch?.skill) {
            const skill = (p as any).dnaPatch.skill as string;
            const skillPath = join(process.cwd(), ".opencode", "skills", skill, "SKILL.md");
            if (!existsSync(skillPath)) {
              const skillDecision = canExecute("write", "orchestrator", "autonomous");
              if (!skillDecision.allowed) continue;
              mkdirSync(dirname(skillPath), { recursive: true });
              writeFileSync(skillPath, `---\nname: ${skill}\ndescription: Use when ${skill} is needed (auto-evolved by Behavior OS)\n---\n\n# ${skill}\n\nAuto-evolved skill for ${p.reason}. DNA patch: ${JSON.stringify((p as any).dnaPatch)}\n`, "utf-8");
              await client.app.log({ body: { service: "behaviorOS", level: "info", message: `Self-evolution: created skill ${skillPath}` } });
            }
          }
          if ((p as any).kind === "new-workflow") {
            const wfDecision = canExecute("write", "orchestrator", "autonomous");
            if (!wfDecision.allowed) continue;
            const { generateWorkflow } = await import("../../packages/orchestrator/workflow-generator.ts");
            const { planTeam } = await import("../../packages/orchestrator/planner.ts");
            const team = planTeam("evolve gap: " + p.reason);
            const hash = p.reason.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 24).toLowerCase();
            const wf = generateWorkflow(`evolved-${hash}`, team);
            const wfPath = join(process.cwd(), "behavior-os", "workflows", `${wf.id}.json`);
            if (!existsSync(wfPath)) {
              writeFileSync(wfPath, JSON.stringify(wf, null, 2), "utf-8");
              await client.app.log({ body: { service: "behaviorOS", level: "info", message: `Self-evolution: created workflow ${wfPath} for ${p.reason}` } });
            }
          }
        }
        try {
          const { readdirSync, readFileSync } = await import("node:fs");
          const rtDir = join(process.cwd(), "behavior-os", "runtime");
          const files = readdirSync(rtDir).filter((f: string) => f.endsWith(".json") && f !== "self-evolution.json");
          for (const f of files) {
            const j = JSON.parse(readFileSync(join(rtDir, f), "utf-8"));
            if (j.evaluator && !j.evaluator.approved) {
              await client.app.log({ body: { service: "behaviorOS", level: "info", message: `Self-evolution: found gap in ${f} — ${j.evaluator.feedback.join("; ")}` } });
            }
          }
        } catch {}
      } catch (e) {
        await client.app.log({ body: { service: "behaviorOS", level: "error", message: `Self-evolution failed: ${String(e)}` } });
      }
    },
  };
};

export default BehaviorOSPlugin;
