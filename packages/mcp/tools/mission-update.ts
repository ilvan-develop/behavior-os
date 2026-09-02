/** Tool: mission.update — ADR 007 — zod args/output + defineTool */
import { z } from "zod";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { defineTool } from "../tool.js";

export const MissionUpdateArgs = z.object({
  missionId: z.string().regex(/^[a-zA-Z0-9._-]+$/).describe("mission id to update"),
  title: z.string().min(3).max(100).optional().describe("new title for mission"),
  goal: z.string().min(10).max(500).optional().describe("new goal description"),
  inputs: z.record(z.unknown()).optional().describe("inputs patch to merge (shallow)"),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "FAILED"]).optional().describe("override evidence status"),
});

export const MissionUpdateOutput = z.object({
  missionId: z.string(),
  updated: z.boolean(),
  updatedAt: z.string(),
  file: z.string(),
});

export const missionUpdateTool = defineTool({
  name: "mission.update",
  description: "Update mission metadata and inputs — validates patch and merges into evidence ledger",
  args: MissionUpdateArgs,
  output: MissionUpdateOutput,
  execute: async (args, ctx) => {
    const safeId = args.missionId.replace(/[^a-zA-Z0-9._-]/g, "_");
    const p = join(process.cwd(), "behavior-os", "runtime", `${safeId}.json`);
    let ev: any = {};
    if (existsSync(p)) {
      try { ev = JSON.parse(readFileSync(p, "utf-8")); } catch { ev = {}; }
    } else {
      ev = { missionId: args.missionId, workflowId: ctx.workflowId, stages: [] };
    }
    if (args.title !== undefined) ev.title = args.title;
    if (args.goal !== undefined) ev.goal = args.goal;
    if (args.inputs !== undefined) ev.inputs = { ...(ev.inputs ?? {}), ...args.inputs };
    if (args.status !== undefined) ev.status = args.status;
    ev.updatedAt = new Date().toISOString();
    ev.updatedBy = `gateway:${ctx.missionId}:${ctx.stageId}`;
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(ev, null, 2), "utf-8");
    return { missionId: args.missionId, updated: true, updatedAt: ev.updatedAt, file: `behavior-os/runtime/${safeId}.json` };
  },
});

export default missionUpdateTool;
