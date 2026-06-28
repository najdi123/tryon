// Gemini API pricing (as of June 2026).
// Prices are per 1M tokens. Adjust these if your Google billing shows different rates.

export const PRICING = {
  "gemini-2.5-flash": {
    input: 0.075, // $0.075 per 1M input tokens
    output: 0.3, // $0.30 per 1M output tokens
  },
  "gemini-2.5-flash-image": {
    input: 0.075,
    output: 0.3,
  },
};

export function computeCost(
  model: keyof typeof PRICING,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = PRICING[model];
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  return inputCost + outputCost;
}

export function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(4)}`;
}
