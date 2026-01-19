/**
 * Assertion handling for script validation
 */

export function isAssertion(userInput) {
  const trimmed = userInput.trim();
  const lower = trimmed.toLowerCase();
  return lower.startsWith("assert:") || lower.startsWith("assert ");
}

export function extractAssertionPrompt(userInput) {
  const trimmed = userInput.trim();
  const lower = trimmed.toLowerCase();

  // Handle "assert:" or "Assert:"
  if (lower.startsWith("assert:")) {
    return trimmed.substring("assert:".length).trim();
  }

  // Handle "assert " or "Assert "
  if (lower.startsWith("assert ")) {
    return trimmed.substring("assert".length).trim();
  }

  return trimmed;
}

export function buildAssertionSystemPrompt(baseSystemPrompt, assertionPrompt) {
  return `${baseSystemPrompt}

ASSERTION MODE:
You are now validating an assertion. The user has provided an assertion statement that you must verify.

Your task:
1. Take screenshots and perform LIMITED actions if needed to validate the assertion.
2. Determine if the assertion is TRUE or FALSE based on the current state.
3. You MUST respond with a clear verdict in this exact format:
   - If the assertion is true, include the text: "ASSERTION RESULT: PASS"
   - If the assertion is false or cannot be confidently validated, include: "ASSERTION RESULT: FAIL"
4. After the verdict, provide a brief explanation (1-2 sentences) of why it passed or failed.

The assertion to validate is: "${assertionPrompt}"

Remember:
- If you cannot confidently validate the assertion, treat it as FAIL.
- You must include either "ASSERTION RESULT: PASS" or "ASSERTION RESULT: FAIL" in your response.
- Be thorough but efficient. Only take the actions necessary to validate the assertion.`;
}

export function checkAssertionResult(transcript) {
  const transcriptText = transcript.join("\n");
  const hasPassed = transcriptText.includes("ASSERTION RESULT: PASS");
  const hasFailed = transcriptText.includes("ASSERTION RESULT: FAIL");

  return {
    passed: hasPassed && !hasFailed,
    failed: hasFailed || !hasPassed,
  };
}

export function extractFailureDetails(transcript) {
  const recentTranscript = transcript.slice(-5).join("\n");
  const parts = recentTranscript.split("ASSERTION RESULT: FAIL");
  return parts[1]?.trim() || "Could not confidently validate the assertion.";
}

export function handleAssertionFailure(assertionPrompt, transcript, isHeadlessMode, context) {
  const details = extractFailureDetails(transcript);
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));

  addOutput({ type: 'error', text: '❌ ASSERTION FAILED' });
  addOutput({ type: 'error', text: `Assertion: ${assertionPrompt}` });
  addOutput({ type: 'error', text: `Details: ${details}` });

  if (isHeadlessMode) {
    // Headless mode: exit with error code
    if (context?.exit) {
      context.exit();
    }
    process.exit(1);
  }
  // Interactive mode: caller should clear remaining instructions
}

export function handleAssertionSuccess(assertionPrompt, context = null) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
  addOutput({ type: 'success', text: `✓ Assertion passed: ${assertionPrompt}` });
}
