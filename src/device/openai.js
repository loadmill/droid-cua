import OpenAI from "openai";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";
import { CuaDebugTracer } from "../utils/cua-debug-tracer.js";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const cuaDebugTracer = new CuaDebugTracer(logger);

/**
 * Revise a test script based on user feedback using simple chat completion
 * @param {string} originalScript - The original test script
 * @param {string} revisionRequest - User's requested changes
 * @returns {Promise<string>} - The revised test script
 */
export async function reviseTestScript(originalScript, revisionRequest) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "system",
      content: `You are editing a test script based on user feedback.

Current test script:
${originalScript}

User's revision request:
${revisionRequest}

Apply the user's changes and output the revised test script.

FORMAT RULES:
- One simple instruction per line (NO numbers, NO bullets)
- Use imperative commands: "Open X", "Click Y", "Type Z"
- Include "assert: <condition>" lines to validate expected behavior
- End with "exit"

Output only the revised test script, nothing else.`
    }]
  });

  return response.choices[0].message.content.trim();
}

export async function sendCUARequest({
  messages,
  screenshotBase64,
  previousResponseId,
  callId,
  deviceInfo,
  debugContext,
}) {
  const input = [...messages];

  if (callId && screenshotBase64) {
    input.push({
      type: "computer_call_output",
      call_id: callId,
      output: {
        type: "computer_screenshot",
        image_url: `data:image/png;base64,${screenshotBase64}`,
      },
    });
  }

  const requestParams = {
    model: "computer-use-preview",
    previous_response_id: previousResponseId || undefined,
    tools: [{
      type: "computer_use_preview",
      display_width: deviceInfo.scaled_width,
      display_height: deviceInfo.scaled_height,
      environment: "browser",
    }],
    input,
    store: true,
    reasoning: { generate_summary: "concise" },
    truncation: "auto",
  };
  const trace = cuaDebugTracer.startTurn({
    requestParams,
    input,
    screenshotBase64,
    deviceInfo,
    debugContext,
    previousResponseId
  });
  logger.debug("CUA Request:", trace.requestLog);

  try {
    const response = await openai.responses.create(requestParams);
    cuaDebugTracer.onResponse(trace, response);
    return response;
  } catch (err) {
    cuaDebugTracer.onError(trace, err);
    throw err;
  }
}
