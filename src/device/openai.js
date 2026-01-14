import OpenAI from "openai";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

  // Log request details (without full screenshot to avoid clutter)
  const requestLog = {
    ...requestParams,
    input: input.map(item => {
      if (item.type === "computer_call_output" && item.output?.image_url) {
        // Extract actual base64 length from the image_url
        const imageUrl = item.output.image_url;
        const base64Data = imageUrl.replace('data:image/png;base64,', '');
        return {
          ...item,
          output: {
            ...item.output,
            image_url: `data:image/png;base64,[${base64Data.length} chars]`
          },
          current_url: item.current_url,
          acknowledged_safety_checks: item.acknowledged_safety_checks
        };
      }
      return item;
    })
  };

  logger.debug('CUA Request:', requestLog);

  try {
    const response = await openai.responses.create(requestParams);

    // Log ALL output item types to catch everything
    const outputTypes = (response.output || []).map(item => item.type);

    const toolCalls = (response.output || [])
      .filter(item => item.type === 'computer_call')
      .map(item => ({
        call_id: item.call_id,
        action_type: item.action?.type
      }));

    const safetyChecks = (response.output || [])
      .filter(item => item.type === 'pending_safety_check')
      .map(item => ({
        id: item.id,
        code: item.code
      }));

    // Log full output array if there are unaccounted items
    const accountedItems = toolCalls.length + safetyChecks.length;
    const totalItems = response.output?.length || 0;

    logger.debug('CUA Response:', {
      id: response.id,
      output_length: totalItems,
      output_types: outputTypes,
      tool_calls: toolCalls.length > 0 ? toolCalls : 'none',
      pending_safety_checks: safetyChecks.length > 0 ? safetyChecks : 'none'
    });

    // If we're missing items in our logging, log the full output for investigation
    if (accountedItems < totalItems) {
      logger.debug('UNACCOUNTED OUTPUT ITEMS - Full output array:', response.output);
    }

    return response;
  } catch (err) {
    logger.error('CUA Request failed', { request: requestLog, error: err });
    throw err;
  }
}
