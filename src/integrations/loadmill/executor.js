/**
 * Orchestrates Loadmill flow execution
 */

import { searchFlows, runTestFlow, getTestRunStatus, getApiToken, explainFailure } from "./client.js";
import { interpretLoadmillCommand, selectBestFlow } from "./interpreter.js";
import { logger } from "../../utils/logger.js";

const POLL_INTERVAL_MS = 5000; // 5 seconds
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Wait for a specified number of milliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Poll for test run completion
 * @param {string} runId - The run ID to poll
 * @param {Function} onStatusUpdate - Callback for status updates
 * @returns {Promise<Object>} - Final run status
 */
async function pollForCompletion(runId, onStatusUpdate = () => {}) {
  const startTime = Date.now();

  while (Date.now() - startTime < TIMEOUT_MS) {
    try {
      const status = await getTestRunStatus(runId);
      onStatusUpdate(status);

      // Check if run is complete
      if (status.status === "PASSED" || status.status === "passed") {
        return { success: true, status: "passed", result: status };
      }

      if (status.status === "FAILED" || status.status === "failed") {
        // Try to get failure explanation
        let failureReason = "Test flow failed";
        try {
          const failedFlowRun = status.testSuiteFlowRuns?.find(f => f.status === "FAILED");
          if (failedFlowRun) {
            const explanation = await explainFailure(failedFlowRun.id);
            if (explanation?.reason) {
              failureReason = explanation.reason;
            }
          }
        } catch (err) {
          logger.debug("Could not get failure explanation", { error: err.message });
        }
        return { success: false, status: "failed", result: status, error: failureReason };
      }

      if (status.status === "STOPPED" || status.status === "stopped") {
        return { success: false, status: "stopped", result: status, error: "Test flow was stopped" };
      }

      // Still running, wait and poll again
      await sleep(POLL_INTERVAL_MS);
    } catch (err) {
      logger.error("Error polling Loadmill run status", { runId, error: err.message });
      throw err;
    }
  }

  // Timeout
  return { success: false, status: "timeout", error: "Test run timed out after 5 minutes" };
}

/**
 * Execute a Loadmill command from natural language input
 * @param {string} userInput - Natural language command
 * @param {Object} options - Execution options
 * @param {Function} options.onProgress - Callback for progress updates
 * @returns {Promise<{success: boolean, error?: string, result?: Object}>}
 */
export async function executeLoadmillCommand(userInput, options = {}) {
  const { onProgress = () => {} } = options;

  // Check for API token
  if (!getApiToken()) {
    return {
      success: false,
      error: "LOADMILL_API_TOKEN environment variable is not set. Please set it in your .env file."
    };
  }

  try {
    // Step 1: Interpret the command
    onProgress({ step: "interpreting", message: "Interpreting command..." });
    const interpreted = await interpretLoadmillCommand(userInput);
    logger.debug("Loadmill command interpreted", interpreted);

    // Step 2: Search for flows
    onProgress({ step: "searching", message: `Searching for flows matching "${interpreted.searchQuery}"...` });
    const flows = await searchFlows(interpreted.searchQuery);

    // Ensure flows is an array
    if (!Array.isArray(flows) || flows.length === 0) {
      return {
        success: false,
        error: `No test flows found matching "${interpreted.searchQuery}"`
      };
    }

    // Step 3: Select best match
    onProgress({ step: "selecting", message: `Found ${flows.length} flow(s). Selecting best match...` });
    const { selectedFlow, confidence } = await selectBestFlow(flows, interpreted.searchQuery);

    if (!selectedFlow) {
      return {
        success: false,
        error: "Could not select a matching flow"
      };
    }

    // If action is "search", just return the results
    if (interpreted.action === "search") {
      return {
        success: true,
        action: "search",
        result: {
          flows,
          selectedFlow,
          confidence
        }
      };
    }

    // Step 4: Run the flow
    const flowName = selectedFlow.description || selectedFlow.name || "Unknown";
    onProgress({
      step: "running",
      message: `Running flow "${flowName}" (confidence: ${(confidence * 100).toFixed(0)}%)...`
    });

    const runResult = await runTestFlow(selectedFlow.id, selectedFlow.testSuiteId, {
      parameters: interpreted.parameters
    });

    const runId = runResult.testSuiteRunId || runResult.id || runResult.runId;
    if (!runId) {
      return {
        success: false,
        error: "Failed to start test flow - no run ID returned"
      };
    }

    // Step 5: Poll for completion
    onProgress({ step: "polling", message: `Test started (ID: ${runId}). Waiting for completion...`, runId });

    const finalResult = await pollForCompletion(runId, (status) => {
      onProgress({ step: "polling", message: `Status: ${status.status}...`, runId });
    });

    return {
      ...finalResult,
      flowName,
      flowId: selectedFlow.id,
      runId,
      parameters: interpreted.parameters
    };

  } catch (err) {
    logger.error("Loadmill execution error", { error: err.message, stack: err.stack });
    return {
      success: false,
      error: err.message
    };
  }
}
