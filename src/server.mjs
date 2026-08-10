import { createServer } from "node:http";
import { buildAmazonPutCandidate } from "./connectors/amazon.mjs";
import { buildCreativeChannelManifest } from "./connectors/creative-manifest.mjs";
import { buildShopifyProductUpdateCandidate } from "./connectors/shopify.mjs";
import { createProvider } from "./lib/provider.mjs";
import { PrivacyGateError } from "./lib/privacy.mjs";
import { generateCreative } from "./workflows/creative.mjs";
import { calculateCostEvidence } from "./workflows/cost.mjs";
import { generateListing } from "./workflows/listing.mjs";
import { generateSupportDrafts } from "./workflows/support.mjs";

const MAX_BODY_BYTES = 1_000_000;

function writeJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body exceeds 1 MB");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function startServer({ env = process.env } = {}) {
  const host = env.HOST ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("The lab only binds to localhost. Reverse proxies require a separate security review.");
  }
  const port = Number(env.PORT ?? 4317);
  const provider = createProvider(env);
  const handlers = new Map([
    ["/v1/listing", (body) => generateListing(body, provider)],
    ["/v1/creative", (body) => generateCreative(body, provider)],
    ["/v1/support", (body) => generateSupportDrafts(body, provider)],
    ["/v1/cost", (body) => calculateCostEvidence(body)],
    ["/v1/connectors/amazon", (body) => buildAmazonPutCandidate(body.listing, body.config)],
    ["/v1/connectors/shopify", (body) => buildShopifyProductUpdateCandidate(body.listing, body.config)],
    ["/v1/connectors/creative", (body) => buildCreativeChannelManifest(body.creative, body.config)],
  ]);

  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      return writeJson(response, 200, {
        status: "ok",
        provider: provider.name,
        external_actions_allowed: false,
      });
    }
    const handler = handlers.get(request.url);
    if (request.method !== "POST" || !handler) {
      return writeJson(response, 404, { error: "not_found" });
    }
    try {
      const result = await handler(await readBody(request));
      return writeJson(response, 200, result);
    } catch (error) {
      const status = error instanceof PrivacyGateError ? 422 : 400;
      return writeJson(response, status, { error: error.name, message: error.message });
    }
  });

  server.listen(port, host, () => {
    console.log(`ecommerce-ai-ops-lab listening on http://${host}:${port}`);
    console.log(`provider=${provider.name}; external_actions_allowed=false`);
  });
  return server;
}
