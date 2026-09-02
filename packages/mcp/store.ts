/** Store — writes behavior-os/runtime/mcp.json (ADR 007 Regra de Ouro) */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import type { MarketplaceSnapshot, GatewayInvocation } from "../../src/domain/mcp.js";
import { globalMarketplace } from "./marketplace.js";
import { globalGateway } from "./gateway.js";

export function mcpPath(root = process.cwd()): string {
  return join(root, "behavior-os", "runtime", "mcp.json");
}

export function readMcpSnapshot(root = process.cwd()): any | null {
  const p = mcpPath(root);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; }
}

export function writeMcpSnapshot(snapshot: MarketplaceSnapshot, invocations: GatewayInvocation[] = [], root = process.cwd()): string {
  const validation = globalMarketplace.validate();
  const data = {
    version: snapshot.version,
    updatedAt: snapshot.updatedAt,
    tools: snapshot.tools,
    servers: snapshot.servers,
    validation,
    invocations,
  };
  const p = mcpPath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
  return p;
}

export function ensureMcpSnapshot(root = process.cwd()): any {
  const snap = globalMarketplace.snapshot();
  // try to collect invocations from all missions (globalGateway)
  // For global file we collect from demo or empty
  let inv: GatewayInvocation[] = [];
  try {
    // if gateway has demo invocations, include
    inv = globalGateway.getInvocations("demo");
  } catch {}
  const p = writeMcpSnapshot(snap, inv, root);
  return readMcpSnapshot(root);
}

export function snapshotForMission(missionId: string, root = process.cwd()) {
  const snap = globalMarketplace.snapshot();
  let inv: GatewayInvocation[] = [];
  try { inv = globalGateway.getInvocations(missionId); } catch {}
  writeMcpSnapshot(snap, inv, root);
  return { snapshot: snap, invocations: inv };
}
