function round(value) {
  return Math.round(value * 100) / 100;
}

export function calculateCostEvidence(input) {
  const threshold = 0.3;
  const scenarios = input.scenarios.map((scenario) => {
    if (scenario.outputs_accepted <= 0 || scenario.outputs_accepted > scenario.outputs_generated) {
      throw new Error(`${scenario.scenario}: outputs_accepted must be between 1 and outputs_generated`);
    }
    const baselineCostPerAccepted =
      (scenario.baseline_minutes_per_accepted_output / 60) * scenario.loaded_hourly_rate;
    const laborMinutes =
      scenario.outputs_generated *
      (scenario.ai_generation_minutes_per_output + scenario.review_minutes_per_output);
    const aiTotalCost =
      (laborMinutes / 60) * scenario.loaded_hourly_rate +
      scenario.model_cost_total +
      scenario.tooling_cost_total +
      scenario.incident_cost_total;
    const aiCostPerAccepted = aiTotalCost / scenario.outputs_accepted;
    const savingsRate = 1 - aiCostPerAccepted / baselineCostPerAccepted;
    const guardrailsPassed = scenario.guardrail_failures === 0;

    return {
      scenario: scenario.scenario,
      baseline_cost_per_accepted_output: round(baselineCostPerAccepted),
      ai_cost_per_accepted_output: round(aiCostPerAccepted),
      full_cost_savings_rate: round(savingsRate),
      acceptance_rate: round(scenario.outputs_accepted / scenario.outputs_generated),
      guardrail_failures: scenario.guardrail_failures,
      decision:
        savingsRate >= threshold && guardrailsPassed
          ? "experiment_threshold_met"
          : "do_not_automate",
    };
  });

  return {
    workflow: "full_cost_evidence/v1",
    evidence_status: input.evidence_status,
    currency: input.currency,
    threshold: { minimum_full_cost_savings_rate: threshold, guardrail_failures: 0 },
    scenarios,
    interpretation:
      input.evidence_status === "fixture"
        ? "Illustrative only. Replace every input with measured merchant data before making an ROI claim."
        : "Decision support only. Human approval remains required.",
  };
}
