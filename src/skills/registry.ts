/** Skill Registry — maps skill id → path + trigger. */
export interface SkillEntry {
  id: string;
  path: string;
  trigger: string;
  description: string;
}

export const skillRegistry: Record<string, SkillEntry> = {
  discover:     { id: "discover",     path: ".opencode/skills/discover/SKILL.md",     trigger: "Use when exploring codebase or repo-observe", description: "Repo observation and discovery" },
  planning:     { id: "planning",     path: ".opencode/skills/planning/SKILL.md",     trigger: "Use when planning tasks", description: "Planning" },
  architecture: { id: "architecture", path: ".opencode/skills/architecture/SKILL.md", trigger: "Use when designing architecture", description: "Architecture review" },
  implementation:{ id: "implementation",path: ".opencode/skills/implementation/SKILL.md",trigger:"Use when implementing changes", description:"Implementation" },
  verification: { id: "verification", path: ".opencode/skills/verification/SKILL.md", trigger: "Use when verifying tests", description: "Verification and QA" },
  security:     { id: "security",     path: ".opencode/skills/security/SKILL.md",     trigger: "Use when security or governance check", description: "Security gate" },
  evidence:     { id: "evidence",     path: ".opencode/skills/evidence/SKILL.md",     trigger: "Use when producing evidence or audit", description: "Evidence ledger" },
};

export function getSkill(id: string): SkillEntry | undefined { return skillRegistry[id]; }
export function listSkills(): SkillEntry[] { return Object.values(skillRegistry); }
