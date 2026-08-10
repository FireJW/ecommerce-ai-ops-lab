# Two-Week Measured Experiment

## Input gate

Copy `templates/measured-experiment.json` outside the repository, replace every
placeholder, remove direct identifiers, and set:

- `evidence_status` to `measured`
- `privacy_attestation` to `direct_identifiers_removed`
- `as_of` to the final measurement date

Do not include customer text, names, emails, addresses, order IDs, store tokens,
supplier names, or unpublished product details. The evaluator stores only the
cost calculation, not the raw input.

## Measurement design

1. Days 1-2: record baseline minutes and loaded labor cost.
2. Days 3-4: configure AI drafting with mandatory review.
3. Days 5-12: run matched products or tickets under equivalent conditions.
4. Days 13-14: blind-review accepted outputs and include rework and incidents.

Use accepted outputs as the denominator. A fast draft that is rejected is still
a cost. Keep conversion, CSAT, policy violations, refunds, and listing takedowns
as guardrails rather than hiding them inside average labor time.

## Evaluate

```powershell
npm run experiment -- D:\path\to\redacted-measurement.json
```

The command refuses fixture/template status and missing privacy attestation. It
writes only the calculated result to the ignored `outputs/` directory.

