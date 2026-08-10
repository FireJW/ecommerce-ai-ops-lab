import { buildProductFacts, snapshotFacts, validateClaims } from "../lib/facts.mjs";
import { assertPublicSafe } from "../lib/privacy.mjs";

const INSTRUCTIONS = `You create marketplace listing drafts. Return JSON only with title, bullets,
description, search_terms, and risk_flags. title is a claim object. bullets and description are arrays
of claim objects. Every claim object has text and fact_ids. Use only supplied facts. Never infer a
certification, health benefit, warranty, compatibility, or absolute performance claim. Set style_only
true only for a claim with no factual content. Do not include personal data. Drafts always require
human review and must never be published automatically.`;

function factValue(product, id) {
  if (id in product) return product[id];
  return product.facts.find((fact) => fact.id === id)?.value;
}

function buildDemo(product) {
  return {
    title: {
      text: `${product.brand} ${factValue(product, "capacity")} ${product.product_type}`,
      fact_ids: ["brand", "capacity", "product_type"],
    },
    bullets: [
      {
        text: `Made from ${factValue(product, "material")} for everyday reuse.`,
        fact_ids: ["material"],
      },
      {
        text: `Keeps drinks cold ${factValue(product, "cold_duration")}.`,
        fact_ids: ["cold_duration"],
      },
      {
        text: `Uses a ${factValue(product, "lid")}.`,
        fact_ids: ["lid"],
      },
      {
        text: `${factValue(product, "care")}; available in ${factValue(product, "colors")}.`,
        fact_ids: ["care", "colors"],
      },
    ],
    description: [
      {
        text: `A ${factValue(product, "capacity")} bottle designed for ${product.audience}.`,
        fact_ids: ["capacity", "product_type", "audience"],
      },
    ],
    search_terms: ["insulated bottle", "commuter bottle", "hiking bottle"],
    risk_flags: [],
  };
}

export async function generateListing(product, provider) {
  assertPublicSafe(product);
  const facts = buildProductFacts(product);
  const draft = await provider.generate({
    task: "listing",
    instructions: INSTRUCTIONS,
    payload: product,
    buildDemo: () => buildDemo(product),
  });
  const groups = [[draft.title], draft.bullets, draft.description];
  const issues = groups.flatMap((claims, index) =>
    validateClaims(claims, facts, ["title", "bullets", "description"][index]),
  );
  const allText = groups.flat().map((claim) => claim?.text ?? "").join(" ").toLowerCase();
  for (const prohibited of product.prohibited_claims ?? []) {
    if (allText.includes(prohibited.toLowerCase())) {
      issues.push(`draft contains prohibited claim: ${prohibited}`);
    }
  }

  return {
    workflow: "listing_pack/v1",
    provider: provider.name,
    sku: product.sku,
    draft,
    fact_snapshot: snapshotFacts(groups, facts),
    validation: { passed: issues.length === 0, issues },
    review_required: true,
    publish_allowed: false,
  };
}

