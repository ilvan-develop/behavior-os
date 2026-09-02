import { describe, it, expect } from "vitest";
import { canExecute } from "../packages/gateway/gateway.js";

describe("gateway — v3.3 Tool Gateway", () => {
  it("allows normal execution", () => {
    expect(canExecute("read", "researcher", "development").allowed).toBe(true);
  });
  it("blocks security write due to DNA invariant", () => {
    expect(canExecute("write", "security", "security-audit").allowed).toBe(false);
  });
  it("blocks researcher bash (read-only)", () => {
    expect(canExecute("bash", "researcher", "development").allowed).toBe(false);
  });
  it("allows evidence with trace", () => {
    const r = canExecute("write", "implementer", "feature");
    expect(r.allowed).toBe(true);
    expect(r.evidence).toContain("tool:write");
  });
});
