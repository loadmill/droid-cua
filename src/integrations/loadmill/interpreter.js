/**
 * AI-powered text interpretation for Loadmill commands
 */

import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Interpret a natural language Loadmill command into structured data
 * @param {string} userInput - Natural language command
 * @returns {Promise<{searchQuery: string, parameters: Object, action: 'run'|'search'}>}
 */
export async function interpretLoadmillCommand(userInput) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a parser that extracts structured data from natural language Loadmill commands.

Extract the following from the user's input:
1. searchQuery: The flow name or description to search for (required). FIX any obvious typos or misspellings.
2. parameters: Any key=value pairs mentioned (as an object)
3. action: Either "run" (if user wants to execute) or "search" (if user just wants to find flows)

Output JSON only, no markdown or explanation.

Examples:
Input: "run the checkout flow with user=test123"
Output: {"searchQuery": "checkout flow", "parameters": {"user": "test123"}, "action": "run"}

Input: "search for login test"
Output: {"searchQuery": "login test", "parameters": {}, "action": "search"}

Input: "run user authentication with email=test@example.com password=secret123"
Output: {"searchQuery": "user authentication", "parameters": {"email": "test@example.com", "password": "secret123"}, "action": "run"}

Input: "execute payment flow"
Output: {"searchQuery": "payment flow", "parameters": {}, "action": "run"}

Input: "create a transction with amount=200"
Output: {"searchQuery": "transaction", "parameters": {"amount": "200"}, "action": "run"}`
      },
      {
        role: "user",
        content: userInput
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message.content;
  const parsed = JSON.parse(content);

  return {
    searchQuery: parsed.searchQuery || userInput,
    parameters: parsed.parameters || {},
    action: parsed.action || "run"
  };
}

/**
 * Select the best matching flow from search results
 * @param {Array} flows - Array of flow objects
 * @param {string} originalQuery - Original user query
 * @returns {Promise<{selectedFlow: Object|null, confidence: number}>}
 */
export async function selectBestFlow(flows, originalQuery) {
  // Ensure flows is an array
  if (!flows || !Array.isArray(flows) || flows.length === 0) {
    return { selectedFlow: null, confidence: 0 };
  }

  if (flows.length === 1) {
    return { selectedFlow: flows[0], confidence: 0.9 };
  }

  // Build a list of flows for the AI to choose from
  const flowList = flows.map((f, i) => {
    const name = f.description || f.name || "Unknown";
    const suite = f.testSuiteDescription || "";
    return `${i + 1}. ID: ${f.id}, Name: "${name}"${suite ? `, Suite: "${suite}"` : ""}`;
  }).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are selecting the best matching test flow based on a user query.

Given the user's query and a list of available flows, select the best match.

Output JSON with:
- index: 1-based index of the best matching flow
- confidence: number between 0 and 1 indicating how confident you are

If no flow seems to match well, set confidence to a low value (< 0.5).

Output JSON only, no markdown.`
      },
      {
        role: "user",
        content: `Query: "${originalQuery}"

Available flows:
${flowList}`
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message.content;
  const parsed = JSON.parse(content);

  const index = (parsed.index || 1) - 1;
  const selectedFlow = flows[index] || flows[0];

  return {
    selectedFlow,
    confidence: parsed.confidence || 0.5
  };
}
