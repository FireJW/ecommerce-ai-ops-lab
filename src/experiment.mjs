import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { assertPublicSafe } from "./lib/privacy.mjs";
import { calculateCostEvidence } from "./workflows/cost.mjs";

const REQUIRED_ATTESTATION = "direct_identifiers_removed";

function safeStudyId(value) {
  const normalized = String(value ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  if (!normalized || normalized.length > 80) throw new Error("study_id must be 1-80 public-safe characters");
  return normalized;
}

export function evaluateMeasuredExperiment(input) {
  assertPublicSafe(input);
  if (input.evidence_status !== "measured") {
    throw new Error("evidence_status must be measured; fixture and template inputs are not real evidence");
  }
  if (input.privacy_attestation !== REQUIRED_ATTESTATION) {
    throw new Error(`privacy_attestation must equal ${REQUIRED_ATTESTATION}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.as_of ?? "")) {
    throw new Error("as_of must be an ISO date such as 2026-08-10");
  }
  const studyId = safeStudyId(input.study_id);
  return {
    schema: "measured_ecommerce_ai_experiment/v1",
    study_id: studyId,
    as_of: input.as_of,
    evidence_status: "measured",
    privacy_attestation: REQUIRED_ATTESTATION,
    source_file_name: input.source_file_name ? basename(input.source_file_name) : undefined,
    cost_evidence: calculateCostEvidence(input),
    external_actions_allowed: false,
  };
}

export async function runMeasuredExperiment(inputPath) {
  const inputText = await readFile(inputPath, "utf8");
  const input = JSON.parse(inputText.replace(/^\uFEFF/, ""));
  const result = evaluateMeasuredExperiment(input);
  const outputDirectory = new URL("../outputs/", import.meta.url);
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = new URL(`experiment-${result.study_id}.json`, outputDirectory);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
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
