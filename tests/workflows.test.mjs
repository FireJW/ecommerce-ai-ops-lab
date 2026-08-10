import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { runDemo } from "../src/pipeline.mjs";
import { evaluateMeasuredExperiment, runMeasuredExperiment } from "../src/experiment.mjs";
import { assertPublicSafe, PrivacyGateError } from "../src/lib/privacy.mjs";
import { generateListing } from "../src/workflows/listing.mjs";

test("offline demo passes workflow validation and remains advisory", async () => {
  const pack = await runDemo({ writeOutput: false, env: { MODEL_PROVIDER: "demo" } });
  assert.equal(pack.evidence_status, "fixture");
  assert.equal(pack.external_actions_allowed, false);
  assert.equal(pack.results.listing.validation.passed, true);
  assert.equal(pack.results.creative.validation.passed, true);
  assert.equal(pack.results.support.validation.passed, true);
  assert.ok(pack.results.cost.scenarios.every((scenario) => scenario.full_cost_savings_rate > 0));
  assert.equal(pack.results.connectors.amazon.schema_ready, false);
  assert.equal(pack.results.connectors.amazon.execution_allowed, false);
  assert.equal(pack.results.connectors.shopify.request.variables.product.status, "DRAFT");
  assert.equal(pack.results.connectors.shopify.execution_allowed, false);
  assert.equal(pack.results.connectors.creative.upload_allowed, false);
});

test("measured experiment requires status and privacy attestation", () => {
  const input = {
    schema: "measured_ecommerce_ai_experiment_input/v1",
    study_id: "merchant-pilot-001",
    as_of: "2026-08-10",
    evidence_status: "measured",
    privacy_attestation: "direct_identifiers_removed",
    currency: "USD",
    scenarios: [
      {
        scenario: "listing",
        outputs_generated: 10,
        outputs_accepted: 8,
        baseline_minutes_per_accepted_output: 30,
        loaded_hourly_rate: 30,
        ai_generation_minutes_per_output: 2,
        review_minutes_per_output: 5,
        model_cost_total: 2,
        tooling_cost_total: 0,
        incident_cost_total: 0,
        guardrail_failures: 0,
      },
    ],
  };
  const result = evaluateMeasuredExperiment(input);
  assert.equal(result.evidence_status, "measured");
  assert.equal(result.external_actions_allowed, false);
  assert.throws(
    () => evaluateMeasuredExperiment({ ...input, evidence_status: "fixture" }),
    /must be measured/,
  );
  assert.throws(
    () => evaluateMeasuredExperiment({ ...input, privacy_attestation: "missing" }),
    /privacy_attestation/,
  );
  assert.throws(
    () => evaluateMeasuredExperiment({ ...input, unexpected_notes: "not retained" }),
    /unsupported fields/,
  );
  assert.throws(
    () => evaluateMeasuredExperiment({ ...input, source_file_name: "merchant-export.json" }),
    /unsupported fields/,
  );
  assert.throws(
    () => evaluateMeasuredExperiment({ ...input, as_of: "2026-02-30" }),
    /real calendar date/,
  );
  assert.throws(
    () => evaluateMeasuredExperiment({ ...input, currency: "usd" }),
    /currency/,
  );
  assert.throws(
    () => evaluateMeasuredExperiment({
      ...input,
      scenarios: [{ ...input.scenarios[0], model_cost_total: Number.NaN }],
    }),
    /finite number/,
  );
  assert.throws(
    () => evaluateMeasuredExperiment({
      ...input,
      scenarios: [{ ...input.scenarios[0], loaded_hourly_rate: -1 }],
    }),
    /greater than 0/,
  );
  assert.throws(
    () => evaluateMeasuredExperiment({
      ...input,
      scenarios: [{ ...input.scenarios[0], merchant_name: "not retained" }],
    }),
    /unsupported fields/,
  );
  assert.throws(
    () => evaluateMeasuredExperiment({
      ...input,
      scenarios: [input.scenarios[0], { ...input.scenarios[0] }],
    }),
    /scenario names must be unique/,
  );
});

test("measured experiment CLI reader accepts a Windows UTF-8 BOM", async () => {
  const studyId = `bom-validation-${process.pid.toString(36)}-${Date.now().toString(36)}`;
  const input = {
    schema: "measured_ecommerce_ai_experiment_input/v1",
    study_id: studyId,
    as_of: "2026-08-10",
    evidence_status: "measured",
    privacy_attestation: "direct_identifiers_removed",
    currency: "USD",
    scenarios: [
      {
        scenario: "listing",
        outputs_generated: 2,
        outputs_accepted: 2,
        baseline_minutes_per_accepted_output: 30,
        loaded_hourly_rate: 30,
        ai_generation_minutes_per_output: 2,
        review_minutes_per_output: 5,
        model_cost_total: 1,
        tooling_cost_total: 0,
        incident_cost_total: 0,
        guardrail_failures: 0,
      },
    ],
  };
  const outputDirectory = new URL("../outputs/", import.meta.url);
  await mkdir(outputDirectory, { recursive: true });
  const inputPath = new URL(`${studyId}-input.json`, outputDirectory);
  const outputPath = new URL(`experiment-${studyId}.json`, outputDirectory);
  try {
    await writeFile(inputPath, `\uFEFF${JSON.stringify(input)}`, "utf8");
    const result = await runMeasuredExperiment(inputPath);
    assert.equal(result.study_id, studyId);
    await assert.rejects(() => runMeasuredExperiment(inputPath), /already exists/);
  } finally {
    await rm(inputPath, { force: true });
    await rm(outputPath, { force: true });
  }
});

test("measured experiment rejects merchant-export-sized input before parsing", async () => {
  const fileId = `oversized-${process.pid.toString(36)}-${Date.now().toString(36)}`;
  const outputDirectory = new URL("../outputs/", import.meta.url);
  await mkdir(outputDirectory, { recursive: true });
  const inputPath = new URL(`${fileId}.json`, outputDirectory);
  try {
    await writeFile(inputPath, "x".repeat((64 * 1024) + 1), "utf8");
    await assert.rejects(() => runMeasuredExperiment(inputPath), /exceeds 65536 bytes/);
  } finally {
    await rm(inputPath, { force: true });
  }
});

test("privacy gate rejects direct identifiers", () => {
  assert.throws(
    () => assertPublicSafe({ message: "Contact buyer@example.com", order_ref: "REDACTED" }),
    PrivacyGateError,
  );
  assert.throws(() => assertPublicSafe({ customer_email: "redacted" }), PrivacyGateError);
});

test("listing rejects unknown fact references", async () => {
  const product = JSON.parse(
    await readFile(new URL("../fixtures/product.json", import.meta.url), "utf8"),
  );
  const provider = {
    name: "invalid-test-provider",
    async generate() {
      return {
        title: { text: "Unsupported title", fact_ids: ["not_approved"] },
        bullets: [{ text: "Unsupported bullet", fact_ids: ["not_approved"] }],
        description: [{ text: "Unsupported description", fact_ids: ["not_approved"] }],
        search_terms: [],
        risk_flags: [],
      };
    },
  };
  const output = await generateListing(product, provider);
  assert.equal(output.validation.passed, false);
  assert.ok(output.validation.issues.some((issue) => issue.includes("not_approved")));
  assert.equal(output.publish_allowed, false);
});

test("n8n workflow artifact is valid JSON and calls localhost", async () => {
  const workflow = JSON.parse(
    await readFile(new URL("../workflows/n8n/ecommerce-ai-review-loop.json", import.meta.url), "utf8"),
  );
  assert.equal(workflow.active, false);
  assert.ok(workflow.nodes.some((node) => node.type === "n8n-nodes-base.httpRequest"));
  assert.ok(JSON.stringify(workflow).includes("127.0.0.1:4317/v1/listing"));
});
