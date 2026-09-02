export type LifecycleState = "created" | "discovery" | "planned" | "executing" | "blocked" | "waiting-human" | "verifying" | "review" | "completed" | "failed";

const transitions: Record<LifecycleState, LifecycleState[]> = {
  created: ["discovery"],
  discovery: ["planned", "failed"],
  planned: ["executing"],
  executing: ["verifying", "blocked", "failed"],
  blocked: ["waiting-human", "failed"],
  "waiting-human": ["executing", "failed"],
  verifying: ["review", "failed"],
  review: ["completed", "failed", "executing"],
  completed: [],
  failed: [],
};

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function nextState(current: LifecycleState, event: string): LifecycleState {
  if (event === "workflow.started" && current === "created") return "discovery";
  if (event === "plan.completed" && current === "discovery") return "planned";
  if (event === "execution.started" && current === "planned") return "executing";
  if (event === "blocked") return "blocked";
  if (event === "approval.granted" && current === "waiting-human") return "executing";
  if (event === "verification.started" && current === "executing") return "verifying";
  if (event === "review.passed" && current === "verifying") return "review";
  if (event === "workflow.completed" && current === "review") return "completed";
  if (event === "workflow.failed") return "failed";
  return current;
}
