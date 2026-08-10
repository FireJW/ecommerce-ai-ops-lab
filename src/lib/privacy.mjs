const SENSITIVE_KEY = /(^|_)(email|phone|address|full_name|customer_name|access_token|refresh_token|api_key|password|card_number)($|_)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?<![A-Z0-9])(?:\+?\d[\s().-]*){10,15}(?![A-Z0-9])/i;
const PAYMENT_CARD = /\b(?:\d[ -]*?){13,19}\b/;

export class PrivacyGateError extends Error {
  constructor(issues) {
    super(`Privacy gate rejected the payload: ${issues.join("; ")}`);
    this.name = "PrivacyGateError";
    this.issues = issues;
  }
}

export function inspectPrivacy(value, path = "payload", issues = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectPrivacy(item, `${path}[${index}]`, issues));
    return issues;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) {
        issues.push(`${path}.${key} uses a blocked sensitive field name`);
        continue;
      }
      inspectPrivacy(child, `${path}.${key}`, issues);
    }
    return issues;
  }

  if (typeof value !== "string") {
    return issues;
  }

  if (EMAIL.test(value)) issues.push(`${path} contains an email address`);
  if (PHONE.test(value)) issues.push(`${path} contains a possible phone number`);
  if (PAYMENT_CARD.test(value)) issues.push(`${path} contains a possible payment card number`);
  return issues;
}

export function assertPublicSafe(value) {
  const issues = inspectPrivacy(value);
  if (issues.length > 0) throw new PrivacyGateError(issues);
}

