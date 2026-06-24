---
issue: 02
title: One engineer's workload, zero new hires.
slug: workflow-notes-02
date: 2026-06-24
description: An on-prem LLM now triages infrastructure logs autonomously — suppressing noise, escalating real incidents, and teaching itself to get quieter over time.
image: assets/enterprise-command-center.png
imageAlt: Abstract enterprise command center with infrastructure monitoring signals
---

## Opening note: Alert fatigue buries real failures in noise

Three things made manual triage unsustainable for small ops teams.

- Every warning pinged everyone. Operators learned to ignore alerts — killing the point of alerting.
- No memory. The same benign warning got re-investigated forever, because nothing recorded "this is safe to ignore."
- No spare capacity. No NOC, no on-call rotation. Triage stole time from everything else.

## Pattern: Wire an LLM into the alerting control flow

An LLM running in two modes handles the work. **Interactive** — an operator asks about a log event, the model diagnoses it in plain language, and if it's benign, automatically writes a signature to a persistent exclusions file. **Automated** — a lightweight subprocess asks the model one question per event and forces a machine-parseable verdict:

```
NO_ACTION:     <one-sentence justification>
EXCLUDE:       <minimal signature for this event class>
ACTION_NEEDED: <explanation and recommended fix>
```

`NO_ACTION` silently logs and posts nothing. `ACTION_NEEDED` escalates to on-call immediately with a recommended fix, not a raw log dump.

The core insight: a self-pruning feedback loop. Every benign event the model classifies makes the system quieter next time. Real anomalies — which don't match prior signatures — keep surfacing.

## ROI: Tokens vs. a salary

A busy log stream might surface 200–500 candidate events per day. Each triage call is small — a few hundred tokens of log context in, a one-line verdict out — roughly 1,500 tokens per event all-in.

| Item | Estimate |
|---|---|
| Events triaged/day | ~300 |
| Tokens per event | ~1,500 |
| Tokens/month | ~13.5M |
| Blended cost (~$3–5/M tokens) | **~$40–70/month** |
| Annual token spend | **~$500–850/year** |

A dedicated IT admin or junior NOC analyst runs $90,000–$130,000/year fully loaded. Even a fractional 0.25 FTE of triage time is $22k–$32k/year. The spread is roughly **30–100x in favor of tokens** — before counting faster escalation, no burnout, and reasoning that's auditable instead of locked in someone's head.

> Token costs scale with event volume and model choice. But the self-pruning loop actively shrinks the volume needing evaluation over time, so real-world cost tends to fall, not climb.

## Results: What the system delivers

- Routine events are suppressed at first classification — fewer false alarms immediately.
- The exclusion store grows itself, with a rationale on every entry.
- Every suppression keeps its "why" — decisions are auditable, not opaque.
- Real incidents still fire instantly, with a recommended fix attached.
- Runs on existing hardware, under unprivileged user-level services, no cloud lock-in.

## Before production: Harden before you scale

- **Bound the signatures.** Over-broad patterns can mask real incidents — validate minimality, don't assume it.
- **Audit the list.** Schedule a human review to catch drift.
- **Secrets hygiene.** Keep credentials out of logs and config; rotate anything exposed in development.

## Executive question: Is your ops team triaging — or just surviving?

A constrained, contract-driven LLM can be a reliable autonomous triage layer — not a chatbot on a dashboard, but a decision component in the control flow that pays for an engineer's worth of work at the price of a few coffees a month. The model doesn't replace the engineer. It removes the reason to hire a second one.
