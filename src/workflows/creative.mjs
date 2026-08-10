import { buildProductFacts, snapshotFacts, validateClaims } from "../lib/facts.mjs";
import { assertPublicSafe } from "../lib/privacy.mjs";

const INSTRUCTIONS = `Create a short-form ecommerce creative brief as JSON only. Return angle,
scenes, caption, and compliance_notes. scenes and caption are claim objects with text and fact_ids.
Use only supplied facts. Do not invent creator testimonials, discounts, medical claims, reviews, or
product performance. Drafts require human review and are not approved for upload.`;

function buildDemo(product) {
  return {
    angle: "A commute-to-trail hydration routine",
    scenes: [
      {
        text: `Open on the ${product.brand} ${product.product_type} beside a packed day bag.`,
        fact_ids: ["brand", "product_type"],
      },
      {
        text: "Show the 750 ml capacity and threaded leak-resistant lid in close-up.",
        fact_ids: ["capacity", "lid"],
      },
      {
        text: "Overlay: up to 18 hours cold in the brand's controlled test.",
        fact_ids: ["cold_duration"],
      },
      {
        text: "End with both available colors and a neutral learn-more call to action.",
        fact_ids: ["colors"],
      },
    ],
    caption: [
      {
        text: "A 750 ml insulated bottle for commutes and day hikes. Hand wash only.",
        fact_ids: ["capacity", "product_type", "audience", "care"],
      },
    ],
    compliance_notes: [
      "Do not change the product color or geometry in generated visuals.",
      "Keep the controlled-test qualifier visible with the cold-retention claim.",
      "Obtain likeness and voice consent before using an avatar or creator clone.",
    ],
  };
}

export async function generateCreative(product, provider) {
  assertPublicSafe(product);
  const facts = buildProductFacts(product);
  const draft = await provider.generate({
    task: "creative",
    instructions: INSTRUCTIONS,
    payload: product,
    buildDemo: () => buildDemo(product),
  });
  const groups = [draft.scenes, draft.caption];
  const issues = [
    ...validateClaims(draft.scenes, facts, "scenes"),
    ...validateClaims(draft.caption, facts, "caption"),
  ];

  return {
    workflow: "creative_script_pack/v1",
    provider: provider.name,
    sku: product.sku,
    draft,
    fact_snapshot: snapshotFacts(groups, facts),
    validation: { passed: issues.length === 0, issues },
    review_required: true,
    upload_allowed: false,
  };
}

