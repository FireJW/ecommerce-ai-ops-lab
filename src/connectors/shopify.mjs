import { assertPublicSafe } from "../lib/privacy.mjs";

const PRODUCT_UPDATE_MUTATION = `mutation UpdateProductDraft($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { id title descriptionHtml status }
    userErrors { field message }
  }
}`;

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildShopifyProductUpdateCandidate(listingResult, config) {
  assertPublicSafe({ listingResult, config });
  if (!listingResult.validation?.passed || listingResult.review_required !== true) {
    throw new Error("Shopify candidate requires a validated, human-review listing result");
  }
  const paragraphs = listingResult.draft.description
    .map((claim) => `<p>${escapeHtml(claim.text)}</p>`)
    .join("");
  const bullets = `<ul>${listingResult.draft.bullets
    .map((claim) => `<li>${escapeHtml(claim.text)}</li>`)
    .join("")}</ul>`;

  return {
    connector: "shopify_product_update_candidate/v1",
    api_version: config.api_version,
    endpoint: `https://${config.shop_domain}/admin/api/${config.api_version}/graphql.json`,
    required_scope: "write_products",
    request: {
      query: PRODUCT_UPDATE_MUTATION,
      variables: {
        product: {
          id: config.product_id,
          title: listingResult.draft.title.text,
          descriptionHtml: `${paragraphs}${bullets}`,
          status: "DRAFT",
        },
      },
    },
    review_required: true,
    execution_allowed: false,
  };
}

