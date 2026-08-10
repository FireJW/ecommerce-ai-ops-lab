import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { assertPublicSafe } from "./lib/privacy.mjs";
import { calculateCostEvidence } from "./workflows/cost.mjs";

const INPUT_SCHEMA = "measured_ecommerce_ai_experiment_input/v1";
const REQUIRED_ATTESTATION = "direct_identifiers_removed";
const MAX_INPUT_BYTES = 64 * 1024;
const ROOT_KEYS = new Set([
  "schema",
  "study_id",
  "as_of",
  "evidence_status",
  "privacy_attestation",
  "currency",
  "scenarios",
]);
const SCENARIO_KEYS = new Set([
  "scenario",
  "outputs_generated",
  "outputs_accepted",
  "baseline_minutes_per_accepted_output",
  "loaded_hourly_rate",
  "ai_generation_minutes_per_output",
  "review_minutes_per_output",
  "model_cost_total",
  "tooling_cost_total",
  "incident_cost_total",
  "guardrail_failures",
]);

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
}

function assertExactKeys(value, allowedKeys, label) {
  assertRecord(value, label);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  const missing = [...allowedKeys].filter((key) => !Object.hasOwn(value, key));
  if (unknown.length > 0) throw new Error(`${label} contains unsupported fields: ${unknown.join(", ")}`);
  if (missing.length > 0) throw new Error(`${label} is missing required fields: ${missing.join(", ")}`);
}

function assertFiniteNumber(value, label, { integer = false, minimum = 0, exclusive = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  if (integer && !Number.isInteger(value)) throw new Error(`${label} must be an integer`);
  if (exclusive ? value <= minimum : value < minimum) {
    const comparison = exclusive ? "greater than" : "at least";
    throw new Error(`${label} must be ${comparison} ${minimum}`);
  }
}

function assertPublicIdentifier(value, label) {
  if (typeof value !== "string" || value.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`${label} must be 1-80 lowercase letters, numbers, or single hyphens`);
  }
}

function assertIsoDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be an ISO date such as 2026-08-10`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a real calendar date`);
  }
}

function validateScenario(scenario, index) {
  const label = `scenarios[${index}]`;
  assertExactKeys(scenario, SCENARIO_KEYS, label);
  assertPublicIdentifier(scenario.scenario, `${label}.scenario`);
  assertFiniteNumber(scenario.outputs_generated, `${label}.outputs_generated`, {
    integer: true,
    exclusive: true,
  });
  assertFiniteNumber(scenario.outputs_accepted, `${label}.outputs_accepted`, {
    integer: true,
    exclusive: true,
  });
  if (scenario.outputs_accepted > scenario.outputs_generated) {
    throw new Error(`${label}.outputs_accepted cannot exceed outputs_generated`);
  }
  assertFiniteNumber(
    scenario.baseline_minutes_per_accepted_output,
    `${label}.baseline_minutes_per_accepted_output`,
    { exclusive: true },
  );
  assertFiniteNumber(scenario.loaded_hourly_rate, `${label}.loaded_hourly_rate`, { exclusive: true });
  for (const field of [
    "ai_generation_minutes_per_output",
    "review_minutes_per_output",
    "model_cost_total",
    "tooling_cost_total",
    "incident_cost_total",
  ]) {
    assertFiniteNumber(scenario[field], `${label}.${field}`);
  }
  assertFiniteNumber(scenario.guardrail_failures, `${label}.guardrail_failures`, { integer: true });
}

function validateMeasuredInput(input) {
  assertExactKeys(input, ROOT_KEYS, "experiment input");
  if (input.schema !== INPUT_SCHEMA) throw new Error(`schema must equal ${INPUT_SCHEMA}`);
  assertPublicIdentifier(input.study_id, "study_id");
  assertIsoDate(input.as_of, "as_of");
  if (input.evidence_status !== "measured") {
    throw new Error("evidence_status must be measured; fixture and template inputs are not real evidence");
  }
  if (input.privacy_attestation !== REQUIRED_ATTESTATION) {
    throw new Error(`privacy_attestation must equal ${REQUIRED_ATTESTATION}`);
  }
  if (typeof input.currency !== "string" || !/^[A-Z]{3}$/.test(input.currency)) {
    throw new Error("currency must be a three-letter uppercase currency code");
  }
  if (!Array.isArray(input.scenarios) || input.scenarios.length < 1 || input.scenarios.length > 20) {
    throw new Error("scenarios must contain 1-20 aggregate workflow measurements");
  }
  input.scenarios.forEach(validateScenario);
  const scenarioNames = input.scenarios.map((scenario) => scenario.scenario);
  if (new Set(scenarioNames).size !== scenarioNames.length) {
    throw new Error("scenario names must be unique within a study");
  }
}

export function evaluateMeasuredExperiment(input) {
  assertPublicSafe(input);
  validateMeasuredInput(input);
  return {
    schema: "measured_ecommerce_ai_experiment/v1",
    study_id: input.study_id,
    as_of: input.as_of,
    evidence_status: "measured",
    privacy_attestation: REQUIRED_ATTESTATION,
    cost_evidence: calculateCostEvidence(input),
    external_actions_allowed: false,
  };
}

export async function runMeasuredExperiment(inputPath) {
  const inputStat = await stat(inputPath);
  if (inputStat.size > MAX_INPUT_BYTES) {
    throw new Error(`experiment input exceeds ${MAX_INPUT_BYTES} bytes; pass aggregate measurements only`);
  }
  const inputText = await readFile(inputPath, "utf8");
  const input = JSON.parse(inputText.replace(/^\uFEFF/, ""));
  const result = evaluateMeasuredExperiment(input);
  const outputDirectory = new URL("../outputs/", import.meta.url);
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = new URL(`experiment-${result.study_id}.json`, outputDirectory);
  try {
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`experiment output already exists for study_id ${result.study_id}; use a new study_id`);
    }
    throw error;
  }
  return {
    output: fileURLToDisplayPath(outputPath),
    study_id: result.study_id,
    evidence_status: result.evidence_status,
    scenarios: result.cost_evidence.scenarios,
  };
}

function fileURLToDisplayPath(url) {
  return decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:\/)/, "$1");
}
