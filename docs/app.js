const state = { data: null, view: "overview" };

const elements = {
  summary: document.querySelector("#summary-strip"),
  view: document.querySelector("#view-container"),
  evidence: document.querySelector("#evidence-list"),
  connectors: document.querySelector("#connector-list"),
  tabs: [...document.querySelectorAll("[data-view]")],
  download: document.querySelector("#download-evidence"),
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const formatMoney = (value) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: state.data?.results.cost.currency ?? "USD",
  maximumFractionDigits: 2,
}).format(value);

const formatPercent = (value) => `${Math.round(value * 100)}%`;
const titleCase = (value) => String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function renderSummary() {
  const { listing, creative, support, cost, connectors } = state.data.results;
  const validations = [listing, creative, support].filter((result) => result.validation.passed).length;
  const averageSavings = cost.scenarios.reduce((sum, scenario) => sum + scenario.full_cost_savings_rate, 0) / cost.scenarios.length;
  const items = [
    ["Validated workflows", `${validations}/3`, "Claim and policy references passed"],
    ["Illustrative savings", formatPercent(averageSavings), "Fixture average, not merchant ROI"],
    ["Dry-run connectors", Object.keys(connectors).length, "Amazon, Shopify, creative channels"],
    ["External actions", "Disabled", "Human approval remains mandatory"],
  ];
  elements.summary.innerHTML = items.map(([label, value, note]) => `
    <div class="summary-item">
      <span class="summary-label">${escapeHtml(label)}</span>
      <strong class="summary-value">${escapeHtml(value)}</strong>
      <span class="summary-note">${escapeHtml(note)}</span>
    </div>
  `).join("");
}

function renderEvidenceRail() {
  const { provider, evidence_status: evidenceStatus, external_actions_allowed: actionsAllowed } = state.data;
  const facts = [
    ["Evidence", evidenceStatus],
    ["Provider", provider],
    ["Input", "Synthetic SKU and tickets"],
    ["Privacy", "Direct identifiers blocked"],
    ["Actions", actionsAllowed ? "Enabled" : "Disabled"],
  ];
  elements.evidence.innerHTML = facts.map(([label, value]) => `
    <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
  `).join("");

  const connectors = [
    ["Amazon Listings", "Schema review"],
    ["Shopify Admin", "Draft only"],
    ["TikTok / YouTube", "Manifest only"],
  ];
  elements.connectors.innerHTML = connectors.map(([name, status]) => `
    <div class="connector-row"><strong>${escapeHtml(name)}</strong><span class="state-label">${escapeHtml(status)}</span></div>
  `).join("");
}

function costBars() {
  return state.data.results.cost.scenarios.map((scenario) => {
    const aiWidth = Math.max(4, Math.round((scenario.ai_cost_per_accepted_output / scenario.baseline_cost_per_accepted_output) * 100));
    return `
      <div class="cost-group">
        <strong>${escapeHtml(titleCase(scenario.scenario))}</strong>
        <div class="bars" aria-label="${escapeHtml(titleCase(scenario.scenario))} baseline versus AI full cost">
          <div class="bar-track" title="Baseline ${formatMoney(scenario.baseline_cost_per_accepted_output)}"><span class="bar" style="width:100%"></span></div>
          <div class="bar-track" title="AI ${formatMoney(scenario.ai_cost_per_accepted_output)}"><span class="bar bar--ai" style="width:${aiWidth}%"></span></div>
        </div>
        <span class="cost-number">-${formatPercent(scenario.full_cost_savings_rate)}</span>
      </div>
    `;
  }).join("");
}

function costTable() {
  return `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Workflow</th><th data-numeric>Baseline</th><th data-numeric>AI full cost</th><th data-numeric>Accepted</th><th>Decision</th></tr></thead>
        <tbody>${state.data.results.cost.scenarios.map((scenario) => `
          <tr>
            <td>${escapeHtml(titleCase(scenario.scenario))}</td>
            <td data-numeric>${formatMoney(scenario.baseline_cost_per_accepted_output)}</td>
            <td data-numeric>${formatMoney(scenario.ai_cost_per_accepted_output)}</td>
            <td data-numeric>${formatPercent(scenario.acceptance_rate)}</td>
            <td class="${scenario.decision === "experiment_threshold_met" ? "decision-ok" : "decision-blocked"}">${escapeHtml(titleCase(scenario.decision))}</td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderOverview() {
  return `
    <div class="section-heading">
      <div><p class="eyebrow">Full-cost comparison</p><h2>Cost per accepted output</h2></div>
      <p>Baseline labor versus generation, review, model, tooling, and incident cost. Both bars share the same scale.</p>
    </div>
    <div class="cost-chart">${costBars()}</div>
    ${costTable()}
  `;
}

function claimsList(claims) {
  return `<ul class="claim-list">${claims.map((claim) => `
    <li>${escapeHtml(claim.text)}<code>${escapeHtml((claim.fact_ids ?? []).join(" | "))}</code></li>
  `).join("")}</ul>`;
}

function factsList(facts) {
  return `<dl class="fact-list">${Object.entries(facts).map(([key, value]) => `
    <div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>
  `).join("")}</dl>`;
}

function renderListing() {
  const result = state.data.results.listing;
  return `
    <div class="section-heading">
      <div><p class="eyebrow">Listing pack</p><h2>${escapeHtml(result.draft.title.text)}</h2></div>
      <p>Every factual statement carries approved source IDs. Publishing remains disabled.</p>
    </div>
    <div class="detail-grid">
      <div>
        <section class="detail-section"><h3>Marketplace bullets</h3>${claimsList(result.draft.bullets)}</section>
        <section class="detail-section"><h3>Description</h3>${claimsList(result.draft.description)}</section>
      </div>
      <section class="detail-section"><h3>Source fact snapshot</h3>${factsList(result.fact_snapshot)}</section>
    </div>
  `;
}

function renderCreative() {
  const result = state.data.results.creative;
  return `
    <div class="section-heading">
      <div><p class="eyebrow">Creative pack</p><h2>${escapeHtml(result.draft.angle)}</h2></div>
      <p>TikTok Ads and YouTube Shopping receive a manifest only. Avatar, voice, labeling, and product fidelity require review.</p>
    </div>
    <div class="detail-grid">
      <section class="detail-section"><h3>Scene sequence</h3><ol class="scene-list">${result.draft.scenes.map((scene) => `
        <li>${escapeHtml(scene.text)}<code>${escapeHtml(scene.fact_ids.join(" | "))}</code></li>
      `).join("")}</ol></section>
      <section class="detail-section"><h3>Compliance notes</h3><ul class="claim-list">${result.draft.compliance_notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul></section>
    </div>
  `;
}

function renderSupport() {
  const result = state.data.results.support;
  return `
    <div class="section-heading">
      <div><p class="eyebrow">Support drafts</p><h2>Policy-grounded responses</h2></div>
      <p>Only low-risk drafts are generated. Address changes and carrier actions route to human review.</p>
    </div>
    <div class="ticket-list">${result.tickets.map((ticket) => `
      <article class="ticket-item">
        <div class="ticket-meta"><strong>${escapeHtml(ticket.id)}</strong><span>${escapeHtml(titleCase(ticket.intent))} | ${formatPercent(ticket.confidence)}</span></div>
        <p>${escapeHtml(ticket.draft.text)}</p>
        <small>Proposed: ${escapeHtml(titleCase(ticket.proposed_action))} | Auto execute: no</small>
      </article>
    `).join("")}</div>
  `;
}

function renderCost() {
  return `
    <div class="section-heading">
      <div><p class="eyebrow">Experiment economics</p><h2>Measured denominator: accepted output</h2></div>
      <p>${escapeHtml(state.data.results.cost.interpretation)}</p>
    </div>
    ${costTable()}
    <section class="detail-section">
      <h3>Experiment threshold</h3>
      <p>At least ${formatPercent(state.data.results.cost.threshold.minimum_full_cost_savings_rate)} full-cost savings and ${state.data.results.cost.threshold.guardrail_failures} material guardrail failures.</p>
    </section>
  `;
}

const renderers = { overview: renderOverview, listing: renderListing, creative: renderCreative, support: renderSupport, cost: renderCost };

function renderView() {
  elements.tabs.forEach((tab) => {
    const selected = tab.dataset.view === state.view;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  elements.view.setAttribute("aria-labelledby", `tab-${state.view}`);
  elements.view.innerHTML = renderers[state.view]();
  history.replaceState(null, "", state.view === "overview" ? location.pathname : `#${state.view}`);
}

elements.tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    state.view = tab.dataset.view;
    renderView();
  });

  tab.addEventListener("keydown", (event) => {
    const lastIndex = elements.tabs.length - 1;
    const destinations = {
      ArrowLeft: index === 0 ? lastIndex : index - 1,
      ArrowRight: index === lastIndex ? 0 : index + 1,
      End: lastIndex,
      Home: 0,
    };
    const destination = destinations[event.key];
    if (destination === undefined) return;

    event.preventDefault();
    const nextTab = elements.tabs[destination];
    state.view = nextTab.dataset.view;
    renderView();
    nextTab.focus();
  });
});

elements.download.addEventListener("click", () => {
  const blob = new Blob([`${JSON.stringify(state.data, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ecommerce-ai-ops-fixture-evidence.json";
  link.click();
  URL.revokeObjectURL(url);
});

try {
  const response = await fetch("./data/evidence-pack.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Evidence request failed: ${response.status}`);
  state.data = await response.json();
  const requestedView = location.hash.slice(1);
  if (renderers[requestedView]) state.view = requestedView;
  renderSummary();
  renderEvidenceRail();
  renderView();
  window.__DASHBOARD_READY__ = true;
} catch (error) {
  elements.view.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  window.__DASHBOARD_READY__ = false;
}
