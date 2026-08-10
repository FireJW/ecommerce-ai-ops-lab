import { assertPublicSafe } from "../lib/privacy.mjs";

function attribute(value, config) {
  return {
    value,
    language_tag: config.language_tag,
    marketplace_id: config.marketplace_id,
  };
}

export function buildAmazonPutCandidate(listingResult, config) {
  assertPublicSafe({ listingResult, config });
  if (!listingResult.validation?.passed || listingResult.review_required !== true) {
    throw new Error("Amazon candidate requires a validated, human-review listing result");
  }
  const title = listingResult.draft.title.text;
  const bullets = listingResult.draft.bullets.map((claim) => attribute(claim.text, config));
  const descriptions = listingResult.draft.description.map((claim) => attribute(claim.text, config));
  const productTypeReady = !config.product_type.includes("REQUIRED");

  return {
    connector: "amazon_listings_items_put_candidate/v1",
    upstream_operation: "putListingsItem",
    method: "PUT",
    path: `/listings/2021-08-01/items/${encodeURIComponent(config.seller_id)}/${encodeURIComponent(listingResult.sku)}`,
    query: { marketplaceIds: [config.marketplace_id] },
    body: {
      productType: config.product_type,
      requirements: config.requirements,
      attributes: {
        item_name: [attribute(title, config)],
        bullet_point: bullets,
        product_description: descriptions,
      },
    },
    product_type_definition_required: !productTypeReady,
    schema_ready: false,
    schema_note:
      "Resolve the marketplace Product Type Definition and validate every attribute before signing an SP-API request.",
    review_required: true,
    execution_allowed: false,
  };
}

