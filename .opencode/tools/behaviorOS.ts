// @ts-ignore - tool export is available at runtime
import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "behaviorOS control plane — run mission, check evidence, report status",
  args: {
    action: tool.schema.string().describe("action: status | run-demo | doctor | evidence"),
    missionId: tool.schema.string().optional().describe("mission id for evidence lookup"),
  },
  async execute(args: any) {
    const cwd = process.cwd();
    if (args.action === "status") {
      return `behaviorOS status: check behavior-os/runtime/ and opencode.json mcp.graphify`;
    }
    if (args.action === "doctor") {
      const { spawnSync } = await import("node:child_process");
      const r = spawnSync("npx", ["tsx", "src/cli/doctor.ts"], { cwd, encoding: "utf-8" });
      return r.stdout + r.stderr;
    }
    if (args.action === "evidence" && args.missionId) {
      const { readFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      // sanitize missionId to prevent path traversal
      const safeId = args.missionId.replace(/[^a-zA-Z0-9._-]/g, "_");
      const p = join(cwd, "behavior-os", "runtime", `${safeId}.json`);
      try { return readFileSync(p, "utf-8"); } catch { return `no evidence at ${p}`; }
    }
    if (args.action === "run-demo") {
      const { spawnSync } = await import("node:child_process");
      const r = spawnSync("npx", ["tsx", "src/cli/demo.ts"], { cwd, encoding: "utf-8" });
      return r.stdout + r.stderr;
    }
    return `unknown action ${args.action}`;
  },
});
