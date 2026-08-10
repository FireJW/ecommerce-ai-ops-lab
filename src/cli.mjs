import { runDemo } from "./pipeline.mjs";
import { runMeasuredExperiment } from "./experiment.mjs";
import { runPilotPlan } from "./pilot.mjs";
import { startServer } from "./server.mjs";

const command = process.argv[2] ?? "demo";

if (command === "demo") {
  const evidencePack = await runDemo();
  const summary = evidencePack.results.cost.scenarios.map((scenario) => ({
    scenario: scenario.scenario,
    savings_rate: scenario.full_cost_savings_rate,
    decision: scenario.decision,
  }));
  console.log(JSON.stringify({
    output: "outputs/evidence-pack.json",
    evidence_status: evidencePack.evidence_status,
    provider: evidencePack.provider,
    validation: {
      listing: evidencePack.results.listing.validation.passed,
      creative: evidencePack.results.creative.validation.passed,
      support: evidencePack.results.support.validation.passed,
    },
    cost_summary: summary,
    connectors: {
      amazon: {
        schema_ready: evidencePack.results.connectors.amazon.schema_ready,
        execution_allowed: evidencePack.results.connectors.amazon.execution_allowed,
      },
      shopify: {
        api_version: evidencePack.results.connectors.shopify.api_version,
        execution_allowed: evidencePack.results.connectors.shopify.execution_allowed,
      },
      creative: {
        channels: evidencePack.results.connectors.creative.channels,
        upload_allowed: evidencePack.results.connectors.creative.upload_allowed,
      },
    },
  }, null, 2));
} else if (command === "serve") {
  startServer();
} else if (command === "experiment") {
  const inputPath = process.argv[3];
  if (!inputPath) throw new Error("Usage: node src/cli.mjs experiment <redacted-input.json>");
  const result = await runMeasuredExperiment(inputPath);
  console.log(JSON.stringify(result, null, 2));
} else if (command === "pilot-plan") {
  const inputPath = process.argv[3];
  if (!inputPath) throw new Error("Usage: node src/cli.mjs pilot-plan <plan.json>");
  const result = await runPilotPlan(inputPath);
  console.log(JSON.stringify(result, null, 2));
} else {
  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}
