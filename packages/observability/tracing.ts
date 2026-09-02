/** Observability — OpenTelemetry traces por stage (LEARN-05) — ideia #4 brainstorm */
export interface TraceSpan { traceId: string; stage: string; agent: string; start: string; end?: string; durationMs?: number; status: "ok" | "error"; }

const traces: TraceSpan[] = [];

export function startTrace(stage: string, agent: string): string {
  const id = `trace-${stage}-${Date.now()}`;
  traces.push({ traceId: id, stage, agent, start: new Date().toISOString(), status: "ok" });
  return id;
}

export function endTrace(traceId: string, status: "ok" | "error" = "ok"): void {
  const t = traces.find((x) => x.traceId === traceId);
  if (t) { t.end = new Date().toISOString(); t.durationMs = Date.now() - new Date(t.start).getTime(); t.status = status; }
}

export function getTraces(): TraceSpan[] { return [...traces]; }
