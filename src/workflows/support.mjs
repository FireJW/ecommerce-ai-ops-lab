import { buildPolicyFacts, snapshotFacts, validateClaims } from "../lib/facts.mjs";
import { assertPublicSafe } from "../lib/privacy.mjs";

const INSTRUCTIONS = `Classify each support ticket and draft a response as JSON only. Return an
array named tickets. Each item has id, intent, confidence, draft, proposed_action, and
auto_execute_allowed. draft is a claim object with text and fact_ids referencing policy IDs. Do not
refund, change an address, issue credit, reveal private data, or claim an action happened. Always set
auto_execute_allowed false.`;

function buildDemo(input) {
  return {
    tickets: input.tickets.map((ticket) => {
      const addressChange = ticket.message.toLowerCase().includes("address");
      return addressChange
        ? {
            id: ticket.id,
            intent: "address_change",
            confidence: 0.98,
            draft: {
              text: "Address changes require review and may not be available after carrier acceptance. A support specialist needs to check the order status before confirming anything.",
              fact_ids: ["address_change"],
            },
            proposed_action: "route_to_human",
            auto_execute_allowed: false,
          }
        : {
            id: ticket.id,
            intent: "tracking_delay",
            confidence: 0.96,
            draft: {
              text: "Because tracking has not moved for three business days, support can request a carrier trace. Please allow one additional business day while the trace is reviewed.",
              fact_ids: ["tracking_delay"],
            },
            proposed_action: "request_carrier_trace_after_review",
            auto_execute_allowed: false,
          };
    }),
  };
}

export async function generateSupportDrafts(input, provider) {
  assertPublicSafe(input);
  const policies = buildPolicyFacts(input.policies);
  const result = await provider.generate({
    task: "support",
    instructions: INSTRUCTIONS,
    payload: input,
    buildDemo: () => buildDemo(input),
  });
  const issues = [];
  for (const [index, ticket] of (result.tickets ?? []).entries()) {
    issues.push(...validateClaims([ticket.draft], policies, `tickets[${index}].draft`));
    if (ticket.auto_execute_allowed !== false) {
      issues.push(`tickets[${index}] attempted to enable automatic execution`);
    }
  }
  if (!Array.isArray(result.tickets) || result.tickets.length !== input.tickets.length) {
    issues.push("result ticket count does not match input ticket count");
  }

  return {
    workflow: "support_draft/v1",
    provider: provider.name,
    tickets: result.tickets ?? [],
    policy_snapshot: snapshotFacts(
      (result.tickets ?? []).map((ticket) => [ticket.draft]),
      policies,
    ),
    validation: { passed: issues.length === 0, issues },
    review_required: true,
    send_allowed: false,
  };
}
