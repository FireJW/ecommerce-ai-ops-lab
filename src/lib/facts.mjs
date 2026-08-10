export function buildProductFacts(product) {
  return new Map([
    ["brand", product.brand],
    ["product_type", product.product_type],
    ["audience", product.audience],
    ...product.facts.map((fact) => [fact.id, fact.value]),
  ]);
}

export function buildPolicyFacts(policies) {
  return new Map(policies.map((policy) => [policy.id, policy.value]));
}

export function validateClaims(claims, approvedFacts, label) {
  const issues = [];
  if (!Array.isArray(claims) || claims.length === 0) {
    return [`${label} must contain at least one claim`];
  }

  for (const [index, claim] of claims.entries()) {
    if (!claim || typeof claim.text !== "string" || claim.text.trim() === "") {
      issues.push(`${label}[${index}] has no text`);
      continue;
    }
    const factIds = Array.isArray(claim.fact_ids) ? claim.fact_ids : [];
    if (factIds.length === 0 && claim.style_only !== true) {
      issues.push(`${label}[${index}] has no fact_ids`);
    }
    for (const factId of factIds) {
      if (!approvedFacts.has(factId)) {
        issues.push(`${label}[${index}] references unknown fact_id ${factId}`);
      }
    }
  }
  return issues;
}

export function snapshotFacts(claimGroups, approvedFacts) {
  const referenced = new Set();
  for (const claims of claimGroups) {
    for (const claim of claims) {
      for (const factId of claim.fact_ids ?? []) referenced.add(factId);
    }
  }
  return Object.fromEntries(
    [...referenced].sort().map((factId) => [factId, approvedFacts.get(factId)]),
  );
}

