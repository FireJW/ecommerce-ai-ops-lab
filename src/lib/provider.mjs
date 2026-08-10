import OpenAI from "openai";
import { assertPublicSafe } from "./privacy.mjs";

function parseJsonOutput(text) {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(normalized);
  } catch (error) {
    throw new Error(`Model returned invalid JSON: ${error.message}`);
  }
}

export function createProvider(env = process.env) {
  const providerName = (env.MODEL_PROVIDER ?? "demo").toLowerCase();
  if (providerName === "demo") {
    return {
      name: "demo",
      async generate({ buildDemo }) {
        return buildDemo();
      },
    };
  }

  if (providerName !== "openai") {
    throw new Error(`Unsupported MODEL_PROVIDER: ${providerName}`);
  }
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for MODEL_PROVIDER=openai");
  if (!env.OPENAI_MODEL) throw new Error("OPENAI_MODEL is required for MODEL_PROVIDER=openai");

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL || undefined,
    maxRetries: 1,
    timeout: 30_000,
  });

  return {
    name: `openai:${env.OPENAI_MODEL}`,
    async generate({ instructions, payload }) {
      assertPublicSafe(payload);
      const response = await client.responses.create({
        model: env.OPENAI_MODEL,
        input: [
          { role: "system", content: instructions },
          { role: "user", content: JSON.stringify(payload) },
        ],
      });
      return parseJsonOutput(response.output_text);
    },
  };
}

