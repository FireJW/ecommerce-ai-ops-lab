import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runDemo } from "../src/pipeline.mjs";

const readText = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Pages shell declares the resolved design contracts", async () => {
  const html = await readText("../docs/index.html");
  assert.match(html, /<meta name="design-profile" content="soft-intelligence-surface\/v1">/);
  assert.match(html, /data-design-profile="soft-intelligence-surface\/v1"/);
  assert.match(html, /data-composition-profile="signal-canvas\/v1"/);
  assert.match(html, /id="tab-overview" role="tab" aria-controls="view-container"/);
  assert.match(html, /role="tabpanel" aria-labelledby="tab-overview"/);
});

test("Pages tabs expose roving keyboard navigation", async () => {
  const script = await readText("../docs/app.js");
  assert.match(script, /ArrowLeft/);
  assert.match(script, /ArrowRight/);
  assert.match(script, /nextTab\.focus\(\)/);
});

test("Pages evidence pack is deterministic and keeps external actions disabled", async () => {
  const actualText = await readText("../docs/data/evidence-pack.json");
  const expected = await runDemo({ writeOutput: false, env: { MODEL_PROVIDER: "demo" } });
  delete expected.generated_at;
  expected.snapshot_label = "Synthetic fixture snapshot";
  expected.public_demo = true;

  assert.equal(actualText, `${JSON.stringify(expected, null, 2)}\n`);

  const actual = JSON.parse(actualText);
  assert.equal(actual.external_actions_allowed, false);
  assert.equal(actual.results.listing.publish_allowed, false);
  assert.equal(actual.results.creative.upload_allowed, false);
  assert.equal(actual.results.support.send_allowed, false);
  assert.equal(actual.results.connectors.amazon.execution_allowed, false);
  assert.equal(actual.results.connectors.shopify.execution_allowed, false);
  assert.equal(actual.results.connectors.creative.upload_allowed, false);
});
