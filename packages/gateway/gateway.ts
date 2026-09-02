export function canExecute(tool: any, agent: any, workflow: any) {
  const evidence = `tool:${tool} agent:${agent} workflow:${workflow}`;
  if (agent === "researcher" && (tool === "bash" || tool === "write" || tool === "edit")) {
    return { allowed: false, reason: "researcher is read-only", action: "block", evidence };
  }
  if (agent === "security" && tool === "write") {
    return { allowed: false, reason: "security cannot write due to DNA invariant", action: "block", evidence };
  }
  return { allowed: true, reason: "allow " + tool + " for " + agent + " in " + workflow, action: "pass", evidence };
}
