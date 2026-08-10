import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildAmazonPutCandidate } from "./connectors/amazon.mjs";
import { buildCreativeChannelManifest } from "./connectors/creative-manifest.mjs";
import { buildShopifyProductUpdateCandidate } from "./connectors/shopify.mjs";
import { createProvider } from "./lib/provider.mjs";
import { generateCreative } from "./workflows/creative.mjs";
import { calculateCostEvidence } from "./workflows/cost.mjs";
import { generateListing } from "./workflows/listing.mjs";
import { generateSupportDrafts } from "./workflows/support.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, new URL("../", import.meta.url)), "utf8"));
}

export async function runDemo({ writeOutput = true, env = process.env } = {}) {
  const [product, support, baselines, platformConfig] = await Promise.all([
    readJson("fixtures/product.json"),
    readJson("fixtures/support.json"),
    readJson("fixtures/cost-baselines.json"),
    readJson("fixtures/platform-config.json"),
  ]);
  const provider = createProvider(env);
  const [listing, creative, supportDrafts] = await Promise.all([
    generateListing(product, provider),
    generateCreative(product, provider),
    generateSupportDrafts(support, provider),
  ]);
  const costEvidence = calculateCostEvidence(baselines);
  const connectors = {
    amazon: buildAmazonPutCandidate(listing, platformConfig.amazon),
    shopify: buildShopifyProductUpdateCandidate(listing, platformConfig.shopify),
    creative: buildCreativeChannelManifest(creative, platformConfig.creative),
  };
  const evidencePack = {
    schema: "ecommerce_ai_ops_evidence_pack/v1",
    generated_at: new Date().toISOString(),
    evidence_status: "fixture",
    provider: provider.name,
    advisory_only: true,
    external_actions_allowed: false,
    results: { listing, creative, support: supportDrafts, cost: costEvidence, connectors },
  };

  if (writeOutput) {
    const outputDirectory = new URL("outputs/", new URL("../", import.meta.url));
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(
      new URL("evidence-pack.json", outputDirectory),
      `${JSON.stringify(evidencePack, null, 2)}\n`,
      "utf8",
    );
  }
  return evidencePack;
}

export { ROOT };
