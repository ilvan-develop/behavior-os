/** Loader — bridges .opencode/tools + opencode.json mcp → marketplace (ADR 007) */
import type { McpMarketplace } from "../../src/domain/mcp.js";
import { globalMarketplace } from "./marketplace.js";

export async function loadFromDisk(rootDir: string = process.cwd(), marketplace: McpMarketplace = globalMarketplace) {
  if (marketplace.loadFromDisk) {
    return marketplace.loadFromDisk(rootDir);
  }
  return { loaded: 0, errors: [] as string[] };
}

export async function ensureMarketplaceLoaded(rootDir: string = process.cwd()) {
  return loadFromDisk(rootDir, globalMarketplace);
}
