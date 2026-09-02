/** OpenCode Adapter — implementa ExecutionProvider via .opencode/* nativo */
import type { ExecutionProvider } from "./ports.js";
import { opencodeStatus } from "../../src/adapters/opencode.js";

export const openCodeAdapter: ExecutionProvider = {
  id: "opencode",
  async execute(missionId: string, workflowId: string) {
    const s = opencodeStatus();
    if (!s.installed) throw new Error("opencode not installed");
    return { status: `executed ${missionId} via opencode with ${s.agents} agents` };
  },
};
