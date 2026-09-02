/** Tool: dna.validate — ADR 007 — zod args/output + defineTool */
import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineTool } from "../tool.js";

export const DnaValidateArgs = z.object({
  path: z.string().optional().default("behavior-os/dna/system.dna.yaml").describe("dna file path relative to cwd"),
  content: z.string().optional().describe("inline dna yaml content — if provided, validates content instead of file"),
});

export const DnaValidateOutput = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  dnaPath: z.string(),
  version: z.string().optional(),
  flags: z.record(z.boolean()).optional(),
});

export const dnaValidateTool = defineTool({
  name: "dna.validate",
  description: "Validate DNA yaml — checks schema, version semver, and flags for evolution governance",
  args: DnaValidateArgs,
  output: DnaValidateOutput,
  execute: async (args) => {
    let raw: string | null = null;
    let dnaPath = args.path ?? "behavior-os/dna/system.dna.yaml";
    if (args.content) {
      raw = args.content;
      dnaPath = "<inline>";
    } else {
      const p = join(process.cwd(), dnaPath);
      if (!existsSync(p)) return { valid: false, errors: [`dna file not found: ${p}`], dnaPath };
      try { raw = readFileSync(p, "utf-8"); } catch (e: any) { return { valid: false, errors: [`read_error: ${e.message}`], dnaPath }; }
    }
    const errors: string[] = [];
    let version: string | undefined;
    let flags: Record<string, boolean> | undefined;
    try {
      const { parse } = await import("yaml");
      const parsed: any = parse(raw);
      if (!parsed || typeof parsed !== "object") errors.push("dna yaml must be object");
      else {
        version = parsed.version;
        if (version && !/^\d+\.\d+\.\d+/.test(String(version))) errors.push(`invalid version semver: ${version}`);
        if (parsed.flags && typeof parsed.flags !== "object") errors.push("flags must be object");
        else if (parsed.flags) {
          flags = {};
          for (const [k, v] of Object.entries(parsed.flags)) {
            if (typeof v !== "boolean") errors.push(`flag ${k} must be boolean`);
            else (flags as any)[k] = v;
          }
        }
        // try validator if available
        try {
          const { validateDna } = await import("../../dna/validator.js");
          const r = validateDna(parsed);
          if (!r.valid) errors.push(...(r.errors ?? []));
        } catch {}
      }
    } catch (e: any) {
      errors.push(`yaml_parse_error: ${e.message}`);
    }
    return { valid: errors.length === 0, errors, dnaPath, version, flags };
  },
});

export default dnaValidateTool;
