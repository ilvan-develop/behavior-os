# Production Operations

> Source: BOS-SLIDE-009 · BOS-LESSON-130 · STABLE · 1.3.0 - 1.3.0

## Slide 1: Control Plane

behavior-os/state/control-plane.json version Semver flags.

*Speaker notes:* Versioning.

## Slide 2: Snapshot

evidence.version evidence.controlPlane flags per mission.

*Speaker notes:* Audit.

## Slide 3: OTel W3C

traceId 32 hex spanId 16 hex parentSpanId null.

*Speaker notes:* Tracing.

## Slide 4: Spans

stages+1 = 9 spans mission root.

*Speaker notes:* Structure.

## Slide 5: Traceparent

00-traceId-spanId-01 injectable.

*Speaker notes:* Propagation.

## Slide 6: Doctor

control-plane Semver traces W3C evidence match.

*Speaker notes:* Health.

## Slide 7: Federation

federated.json provenance hash valid.

*Speaker notes:* Knowledge.

## Slide 8: Hands-on

cat traces/demo.json pnpm doctor.

*Speaker notes:* Verify.

