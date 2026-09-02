---
name: behavioros
description: Use when orchestrating DNA-driven governance, deterministic pipelines, or autonomous missions. Triggers on behavioros, DNA, governance, pipeline, mission.
---

# BehaviorOS — OS for AI Agent Teams

DNA-driven rules, deterministic pipelines, autonomous orchestration. Defines how agents think, decide, collaborate, learn.

**Progressive disclosure (agentskills.io spec):**
1. Discovery: name + description above
2. Activation: reads this SKILL.md when mission matches DNA pattern
3. Execution: follows DNA `dnas/enterprise-governance.yaml` + governance `block|escalate|warn|log`

**Usage:**
- `skill({name: "behavioros"})` loads DNA + governance
- `evaluateGovernance('deploy-production', {agent: 'devops'})` → {allowed, action, reasons}
- `createMission({title, type, priority})` → `behavior-os/runtime/*.json`

**Scaffolder:** `npx behavior-os init --preset enterprise-governance` installs `dnas/`, `behavior-os/`, `.opencode/` portável, allows `plugin: ["behaviorOS","outro"]` lado-a-lado.
