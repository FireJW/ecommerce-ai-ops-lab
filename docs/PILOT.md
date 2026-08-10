# Pilot Pre-registration

The default next pilot is `support-draft`, using anonymized support-ticket
aggregates and mandatory human review. This document and
`templates/pilot-plan.json` define a plan; they are not measured evidence and
must not be edited after the pilot starts without a new `study_id`.

## Create The Plan

Copy the template outside the repository, replace only public-safe role labels
and the study ID, then validate and persist the immutable plan:

```powershell
npm run pilot:plan -- D:\path\to\redacted-pilot-plan.json
```

The command writes `outputs/pilot-plan-<study_id>.json`, including a SHA-256
fingerprint. It rejects customer text, contacts, unknown fields, non-14-day
schedules, threshold changes, raw-input retention, and external actions.

## Fixed Schedule

| Days | Stage | Required evidence |
| --- | --- | --- |
| 1-2 | Baseline | Aggregate ticket count, accepted resolution count, minutes, and loaded labor rate |
| 3-4 | Configuration | Prompt/policy snapshot, reviewer role, and dry-run connector state |
| 5-12 | Matched run | Equivalent ticket intents, generation/review minutes, accepted outputs, incidents, and tooling/model cost |
| 13-14 | Blind review | Acceptance, policy failures, refund/address-change escalations, CSAT, rework, and decision |

Do not retain raw tickets or customer identifiers. Keep only aggregate values
needed by `templates/measured-experiment.json`; reference the same `study_id`
when the final measured input is ready.

## Stop Conditions

- Any material policy violation or unapproved external action means
  `do_not_automate`.
- Full-cost savings below 30% means `do_not_automate`.
- Missing, stale, or partial measurements remain blocked rather than becoming
  zeroes.
- The final result is advisory; publishing, refunds, address changes, and
  customer messaging remain human-approved.
