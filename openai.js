import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function sendCUARequest({
  messages,
  screenshotBase64,
  previousResponseId,
  callId,
  pendingSafetyChecks = [],
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

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await openai.responses.create({
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
      });
    } catch (err) {
      if (![500, 502, 503, 504].includes(err.status)) throw err;      
      await new Promise(res => setTimeout(res, 1000));
    }
  }
  
  throw new Error("OpenAI failed after 3 attempts");
}
