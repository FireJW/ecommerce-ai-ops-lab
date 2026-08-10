import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { assertPublicSafe } from "./lib/privacy.mjs";

const PLAN_SCHEMA = "measured_ecommerce_ai_pilot_plan/v1";
const MAX_INPUT_BYTES = 64 * 1024;
const PLAN_KEYS = new Set([
  "schema",
  "study_id",
  "preregistered_on",
  "workflow",
  "unit",
  "owner_role",
  "reviewer_role",
  "baseline_days",
  "configuration_days",
  "measurement_days",
  "review_days",
  "minimum_full_cost_savings_rate",
  "primary_guardrails",
  "raw_input_retained",
  "external_actions_allowed",
]);
const WORKFLOW_UNITS = new Map([
  ["support-draft", "ticket"],
  ["creative-script-pack", "script-pack"],
  ["listing-pack", "listing-pack"],
]);

function assertExactKeys(value, allowedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  const missing = [...allowedKeys].filter((key) => !Object.hasOwn(value, key));
  if (unknown.length > 0) throw new Error(`${label} contains unsupported fields: ${unknown.join(", ")}`);
  if (missing.length > 0) throw new Error(`${label} is missing required fields: ${missing.join(", ")}`);
}

function assertIdentifier(value, label) {
  if (typeof value !== "string" || value.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`${label} must be 1-80 lowercase letters, numbers, or single hyphens`);
  }
}

function assertDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be an ISO date such as 2026-08-10`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a real calendar date`);
  }
}

function assertRole(value, label) {
  if (typeof value !== "string" || value.length > 80 || !/^[a-z0-9][a-z0-9 ._-]*[a-z0-9]$/i.test(value)) {
    throw new Error(`${label} must be a public-safe role label`);
  }
}

function assertInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

export function evaluatePilotPlan(input) {
  assertPublicSafe(input);
  assertExactKeys(input, PLAN_KEYS, "pilot plan");
  if (input.schema !== PLAN_SCHEMA) throw new Error(`schema must equal ${PLAN_SCHEMA}`);
  assertIdentifier(input.study_id, "study_id");
  assertDate(input.preregistered_on, "preregistered_on");
  if (!WORKFLOW_UNITS.has(input.workflow)) {
    throw new Error("workflow must be support-draft, creative-script-pack, or listing-pack");
  }
  if (input.unit !== WORKFLOW_UNITS.get(input.workflow)) {
    throw new Error(`unit must equal ${WORKFLOW_UNITS.get(input.workflow)} for ${input.workflow}`);
  }
  assertRole(input.owner_role, "owner_role");
  assertRole(input.reviewer_role, "reviewer_role");
  for (const [field, minimum, maximum] of [
    ["baseline_days", 1, 7],
    ["configuration_days", 0, 5],
    ["measurement_days", 1, 10],
    ["review_days", 1, 7],
  ]) {
    assertInteger(input[field], field, minimum, maximum);
  }
  const totalDays = input.baseline_days + input.configuration_days + input.measurement_days + input.review_days;
  if (totalDays !== 14) throw new Error("pilot schedule must total exactly 14 days");
  if (input.minimum_full_cost_savings_rate !== 0.3) {
    throw new Error("minimum_full_cost_savings_rate must remain the preregistered 0.3 threshold");
  }
  if (!Array.isArray(input.primary_guardrails) || input.primary_guardrails.length < 1 || input.primary_guardrails.length > 8) {
    throw new Error("primary_guardrails must contain 1-8 guardrail IDs");
  }
  input.primary_guardrails.forEach((guardrail, index) => assertIdentifier(guardrail, `primary_guardrails[${index}]`));
  if (new Set(input.primary_guardrails).size !== input.primary_guardrails.length) {
    throw new Error("primary_guardrails must be unique");
  }
  if (input.raw_input_retained !== false) throw new Error("raw_input_retained must be false");
  if (input.external_actions_allowed !== false) throw new Error("external_actions_allowed must be false");

  return {
    schema: PLAN_SCHEMA,
    status: "preregistered",
    study_id: input.study_id,
    preregistered_on: input.preregistered_on,
    workflow: input.workflow,
    unit: input.unit,
    owner_role: input.owner_role,
    reviewer_role: input.reviewer_role,
    schedule: {
      baseline_days: input.baseline_days,
      configuration_days: input.configuration_days,
      measurement_days: input.measurement_days,
      review_days: input.review_days,
      total_days: totalDays,
    },
    minimum_full_cost_savings_rate: input.minimum_full_cost_savings_rate,
    primary_guardrails: input.primary_guardrails,
    raw_input_retained: false,
    external_actions_allowed: false,
    plan_fingerprint: fingerprint(input),
  };
}

export async function runPilotPlan(inputPath) {
  const inputStat = await stat(inputPath);
  if (inputStat.size > MAX_INPUT_BYTES) {
    throw new Error(`pilot plan exceeds ${MAX_INPUT_BYTES} bytes`);
  }
  const inputText = await readFile(inputPath, "utf8");
  const result = evaluatePilotPlan(JSON.parse(inputText.replace(/^\uFEFF/, "")));
  const outputDirectory = new URL("../outputs/", import.meta.url);
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = new URL(`pilot-plan-${result.study_id}.json`, outputDirectory);
  try {
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`pilot plan already exists for study_id ${result.study_id}; use a new study_id`);
    }
    throw error;
  }
  return {
    output: fileURLToDisplayPath(outputPath),
    study_id: result.study_id,
    status: result.status,
    plan_fingerprint: result.plan_fingerprint,
  };
}

function fileURLToDisplayPath(url) {
  return decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:\/)/, "$1");
}
