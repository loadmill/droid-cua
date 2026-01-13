import OpenAI from "openai";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Log response with tool call and safety check details
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

    logger.debug('CUA Response:', {
      id: response.id,
      output_length: response.output?.length || 0,
      tool_calls: toolCalls.length > 0 ? toolCalls : 'none',
      pending_safety_checks: safetyChecks.length > 0 ? safetyChecks : 'none'
    });

    return response;
  } catch (err) {
    logger.error('CUA Request failed', { request: requestLog, error: err });
    throw err;
  }
}
