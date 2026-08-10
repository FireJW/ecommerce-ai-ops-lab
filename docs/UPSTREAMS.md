# Upstream Capability Map

No upstream source code is vendored. This keeps the repository small and makes
licenses and update boundaries explicit.

| Upstream | Status in this lab | License note |
| --- | --- | --- |
| https://github.com/openai/openai-node | Installed runtime dependency for opt-in model calls | Apache-2.0 |
| https://github.com/n8n-io/n8n | Importable workflow JSON is provided; n8n itself is not bundled | Source-available; not represented here as OSI open source |
| https://github.com/amzn/selling-partner-api-models | Dry-run `putListingsItem` request candidate; Product Type Definition validation still required | Apache-2.0 |
| https://github.com/Shopify/shopify-app-js | Shopify 2026-01 `productUpdate` DRAFT request candidate; SDK installation waits for approved OAuth scope | MIT |
| https://github.com/tiktok/tiktok-business-api-sdk | Channel manifest only; SDK mapping and upload wait for account approval | MIT |

Platform adapters remain dry-run until credentials, scopes, data retention,
and human approval rules are separately reviewed.
