/**
 * Session manages the state for a single CLI session
 * Includes device info, message history, transcript, and response chaining
 */
export class Session {
  constructor(deviceId, deviceInfo) {
    this.deviceId = deviceId;
    this.deviceInfo = deviceInfo;
    this.messages = [];
    this.previousResponseId = null;
    this.transcript = [];
    this.systemPrompt = null;
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(role, content) {
    this.messages.push({ role, content });
  }

  /**
   * Clear all messages (used in execution mode between turns)
   */
  clearMessages() {
    this.messages = [];
  }

  /**
   * Set the system prompt and initialize messages array
   */
  setSystemPrompt(prompt) {
    this.systemPrompt = prompt;
    this.messages = [{ role: "system", content: prompt }];
  }

  /**
   * Add a line to the transcript (for error recovery and logging)
   */
  addToTranscript(line) {
    this.transcript.push(line);
  }

  /**
   * Get the full transcript as a string
   */
  getTranscriptText() {
    return this.transcript.join("\n");
  }

  /**
   * Update the previous response ID for chaining
   */
  updateResponseId(responseId) {
    this.previousResponseId = responseId;
  }
}
