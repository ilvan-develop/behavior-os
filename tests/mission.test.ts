import { describe, it, expect } from "vitest";
import { govern } from "../src/core/governance.js";

describe("mission/governance", () => {
  it("passes valid mission", () => {
    const v = govern({ id:"m1", title:"t", goal:"g", workflowId:"development", createdAt:new Date().toISOString(), inputs:{} });
    expect(v.allowed).toBe(true);
  });
  it("blocks protected path", () => {
    const v = govern({ id:"m1", title:"t", goal:"g", workflowId:"development", createdAt:new Date().toISOString(), inputs:{ file: "prisma/migrations/001.sql" } });
    expect(v.allowed).toBe(false);
  });
  it("fails missing id", () => {
    const v = govern({ id:"", title:"t", goal:"g", workflowId:"development", createdAt:new Date().toISOString(), inputs:{} } as any);
    expect(v.allowed).toBe(false);
  });
});
