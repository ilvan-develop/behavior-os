# AI Agent Governance

> Source: BOS-SLIDE-007 · BOS-LESSON-050 · STABLE · 1.3.0 - 1.3.0

## Slide 1: 4 Actions

block escalate warn log.

*Speaker notes:* Vocab.

## Slide 2: Conditions

risk requiresApproval path stage behaviorLevel.

*Speaker notes:* Triggers.

## Slide 3: OPA Rego

packages/governance/policy.rego.

*Speaker notes:* Policy as Code.

## Slide 4: Fail-closed

Doubt -> block. AND evaluation.

*Speaker notes:* Principle.

## Slide 5: Auto-approve

plugin warn|log auto block|escalate human.

*Speaker notes:* Matrix.

## Slide 6: Audit Chain

audit.log hash chain.

*Speaker notes:* Immutability.

## Slide 7: Hands-on

cat dnas/enterprise-governance.yaml governance.

*Speaker notes:* Write rule.

