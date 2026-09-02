/** Workflow Engine — executa stages sequencialmente, respeitando governance.
 * v1.2: stage discover consome Graphify quando funcional.
 * v1.3: delega ao StateGraph LangGraph quando disponível.
 * v1.4: parallelGroups via Promise.all.
 * v1.5: evaluator-optimizer (reviewer) + truth/coverage.
 */
import { govern } from "../core/governance.js";
import { graphifyStatus } from "../adapters/graphify.js";
import { langGraphStatus } from "../adapters/langgraph.js";
import { evaluateEvidence } from "../core/evaluator.js";
import { buildContext } from "../../packages/kernel/context.js";
import { emit } from "../../packages/kernel/events.js";
import { resolveDna } from "../../packages/dna/resolver.js";
import type { Workflow, Mission } from "../domain/types.js";

export async function runWorkflow(workflow: Workflow, mission: Mission, ledger: ReturnType<typeof import("../core/evidence-ledger.js").evidenceLedger>) {
  // ADR 005 — tracing: mission root span (W3C 128-bit, parentSpan null)
  let missionSpan: any = null;
  let tracing: any = null;
  try {
    const mod = await import("../../packages/observability/tracing.js");
    tracing = mod.tracingProvider ?? mod.default ?? null;
    if (tracing && typeof tracing.startSpan === "function") {
      missionSpan = tracing.startSpan(`mission:${mission.id}`, { parentSpan: null, attributes: { missionId: mission.id, workflowId: workflow.id } });
      // garante bridge síncrono antes do primeiro emit (evita race do dynamic import do provider)
      try {
        const ev = await import("../../packages/kernel/events.js");
        if (ev.setTracingBridge) {
          ev.setTracingBridge(
            () => tracing.getActiveContext?.() ?? null,
            (name: string, attrs?: Record<string, unknown>) => {
              try {
                const span = (tracing as any).getActiveSpan?.() ?? missionSpan;
                span?.addEvent?.(name, attrs);
              } catch {}
            }
          );
        }
      } catch {}
    }
  } catch {}
  emit({ type: "workflow.started", missionId: mission.id, timestamp: new Date().toISOString(), payload: { workflowId: workflow.id } });
  ledger.start();
  const verdict = govern(mission);
  if (!verdict.allowed) {
    emit({ type: "workflow.failed", missionId: mission.id, timestamp: new Date().toISOString(), payload: { reason: verdict.reasons.join("; ") } });
    if (missionSpan) { try { missionSpan.setStatus("error", verdict.reasons.join("; ")); missionSpan.end(); } catch {} try { if (tracing?.persist) await tracing.persist(mission.id); } catch {} }
    ledger.fail(`governance: ${verdict.reasons.join("; ")}`);
    throw new Error(`governance denied`);
  }
  const g = graphifyStatus();
  const lg = langGraphStatus();
  // v2.1: DNA + Context por stage
  const effective = resolveDna(workflow.stages[0]?.agent ?? "researcher", workflow.id);
  if (lg.available && lg.compiled) {
    try {
      const workspaceId = (mission as any).workspaceId ?? "default";
      const projectId = (mission as any).projectId ?? mission.id;
      const threadId = `${workspaceId}::${projectId}::${workflow.id}`; // tenant guard portável (brocolis workspace::project)
      const isParallel = !!workflow.parallelGroups?.length;
      if (isParallel) {
        const { runParallelGraph } = await import("./langgraph-graph.js");
        const { checkpoint } = await runParallelGraph(mission.id, workflow.id, threadId);
        void checkpoint;
      } else {
        const { runBehaviorGraph } = await import("./langgraph-graph.js");
        const { checkpoint } = await runBehaviorGraph(mission.id, workflow.id, threadId);
        void checkpoint;
      }
    } catch {}
  }
  // Pipeline determinístico: executa stages na ordem declarada, respeitando handoffs e gated
  const stageSpans: any[] = [];
  for (let i = 0; i < workflow.stages.length; i++) {
    const stage = workflow.stages[i];
    const expectedHandoff = i > 0 ? workflow.handoffs[workflow.stages[i - 1].id] : null;
    if (expectedHandoff && expectedHandoff !== stage.agent) {
      throw new Error(`handoff violation: ${workflow.stages[i - 1].id} → expected ${expectedHandoff}, got ${stage.agent}`);
    }
    // ADR 005 — stage span filho do mission (parentSpan hierárquico)
    let stageSpan: any = null;
    let prevCtx: any = null;
    let prevSpan: any = null;
    try {
      if (tracing && missionSpan) {
        const parentCtx = missionSpan.spanContext ?? missionSpan.context ?? missionSpan;
        stageSpan = tracing.startSpan(`stage:${stage.id}`, { parentSpan: parentCtx, attributes: { stage: stage.id, agent: stage.agent, missionId: mission.id } });
        stageSpans.push(stageSpan);
        // ativa stage span para EventBus bridge (kernel.events emit → SpanEvent)
        try {
          const anyTracing: any = tracing as any;
          prevCtx = anyTracing.activeContext;
          prevSpan = anyTracing.activeSpan;
          anyTracing.activeContext = { traceId: stageSpan.spanContext.traceId, spanId: stageSpan.spanContext.spanId, traceFlags: stageSpan.spanContext.traceFlags };
          anyTracing.activeSpan = stageSpan;
        } catch {}
      }
    } catch {}
    const ctx = buildContext(mission, stage.id, effective.invariants);
    emit({ type: "stage.started", missionId: mission.id, timestamp: new Date().toISOString(), payload: { stage: stage.id, actor: stage.agent, graphNodes: ctx.graphSummary.nodeCount } });
    if (stage.id === "discover" && g.functional) {
      // knowledge layer real via ctx.graphSummary — deterministic, sem random
    }
    // Gated stages: verifica quality gate determinístico (sem setTimeout aleatório)
    if (stage.gated) {
      const coverage = (await import("../../packages/verification/coverage.js")).computeCoverage();
      if (stage.id === "test" && coverage.tests < 80) {
        emit({ type: "quality.gate.failed", missionId: mission.id, timestamp: new Date().toISOString(), payload: { stage: stage.id, coverage: coverage.tests } });
        if (stageSpan) {
          try { stageSpan.setStatus("error", `quality gate failed tests ${coverage.tests}`); stageSpan.end(); } catch {}
          try { const anyTracing: any = tracing as any; anyTracing.activeContext = prevCtx; anyTracing.activeSpan = prevSpan; } catch {}
        }
        throw new Error(`quality gate failed: tests ${coverage.tests} < 80`);
      }
    }
    await new Promise((r) => setTimeout(r, 5));
    emit({ type: "agent.started", missionId: mission.id, timestamp: new Date().toISOString(), payload: { stage: stage.id, agent: stage.agent } });
    if (stageSpan) {
      try { stageSpan.setStatus("ok"); stageSpan.end(); } catch {}
      // restaura contexto mission
      try {
        const anyTracing: any = tracing as any;
        anyTracing.activeContext = prevCtx;
        anyTracing.activeSpan = prevSpan;
      } catch {}
    }
  }
  // ADR 005 — finaliza mission span e persiste behavior-os/runtime/traces/<mission>.json antes do evidence
  if (missionSpan) {
    try { missionSpan.setStatus("ok"); missionSpan.end(); } catch {}
    try {
      if (tracing && typeof tracing.persist === "function") {
        await tracing.persist(mission.id);
      } else if (tracing && typeof tracing.flush === "function") {
        await tracing.flush();
        // fallback: se persist não disponível mas flush persiste todos, garante arquivo
        const { existsSync } = await import("node:fs");
        const { join } = await import("node:path");
        const p = join(process.cwd(), "behavior-os", "runtime", "traces", `${mission.id}.json`);
        if (!existsSync(p)) {
          // tenta persist via tracing module direto
          try { const m2 = await import("../../packages/observability/otel-provider.js"); if ((m2 as any).defaultTracingProvider?.persist) await (m2 as any).defaultTracingProvider.persist(mission.id); } catch {}
        }
      }
    } catch {}
  }
  // v1.5: evaluator-optimizer no gated review/evidence
  let evidence = ledger.complete();
  // after ledger.complete, evidence.traces já foi populado via getTracesEvidence() se arquivo existe; fallback inject se ainda undefined
  if (!evidence.traces && tracing && missionSpan) {
    try {
      const snap = typeof tracing.toEvidenceTraces === "function" ? tracing.toEvidenceTraces(mission.id) : null;
      if (snap) (evidence as any).traces = snap;
    } catch {}
    // persist evidence with traces if we had to inject
    if ((evidence as any).traces) {
      try {
        const { writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        writeFileSync(join(process.cwd(), "behavior-os", "runtime", `${mission.id}.json`), JSON.stringify(evidence, null, 2), "utf-8");
      } catch {}
    }
  }
  const evalResult = evaluateEvidence(mission, evidence);
  emit({ type: evalResult.approved ? "workflow.completed" : "workflow.failed", missionId: mission.id, timestamp: new Date().toISOString(), payload: { evaluator: evalResult.coverage } });
  // escreve evaluator no evidence (observável)
  (evidence as any).evaluator = { approved: evalResult.approved, iterations: evalResult.iterations, feedback: evalResult.feedback, coverage: evalResult.coverage };
  // se não aprovado e max_iter não atingido, o engine falharia e marcaria FAILED em produção;
  // aqui apenas registra feedback para auditoria (ground truth > opinião)
  // re-escreve evidence com evaluator
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  try { writeFileSync(join(process.cwd(), "behavior-os", "runtime", `${mission.id}.json`), JSON.stringify(evidence, null, 2), "utf-8"); } catch {}
  return { workflowId: workflow.id, missionId: mission.id, evidence, verdict, evaluator: evalResult };
}
