/**
 * Loadmill API client for interacting with test flows
 */

import dotenv from "dotenv";
dotenv.config();

const DEFAULT_BASE_URL = "https://app.loadmill.com/api";

/**
 * Get Loadmill API token from environment
 * @returns {string|null}
 */
export function getApiToken() {
  return process.env.LOADMILL_API_TOKEN || null;
}

/**
 * Get Loadmill base URL from environment
 * @returns {string}
 */
export function getBaseUrl() {
  return process.env.LOADMILL_BASE_URL || DEFAULT_BASE_URL;
}

/**
 * Make an authenticated request to Loadmill API
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>}
 */
async function apiRequest(endpoint, options = {}) {
  const token = getApiToken();
  if (!token) {
    throw new Error("LOADMILL_API_TOKEN environment variable is not set");
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Loadmill API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Search for test flows by query
 * @param {string} searchQuery - Search query string
 * @param {Object} options - Additional options
 * @param {number} options.limit - Maximum number of results (default: 10)
 * @returns {Promise<Array>} - Array of matching flows
 */
export async function searchFlows(searchQuery, options = {}) {
  const { limit = 10 } = options;
  const encodedQuery = encodeURIComponent(searchQuery);

  const result = await apiRequest(`/test-flows?search=${encodedQuery}&limit=${limit}`);

  // Handle different response formats
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray(result.flows)) {
    return result.flows;
  }
  if (result && Array.isArray(result.data)) {
    return result.data;
  }
  if (result && Array.isArray(result.items)) {
    return result.items;
  }
  if (result && Array.isArray(result.testFlows)) {
    return result.testFlows;
  }

  // Log unexpected response format for debugging
  console.error("[Loadmill] Unexpected API response format:", JSON.stringify(result, null, 2));
  return [];
}

/**
 * Run a test suite with specified flows
 * @param {string} suiteId - Test suite ID
 * @param {Object} options - Run options
 * @param {string[]} options.flowIds - Array of flow IDs to run
 * @param {Object} options.parameters - Parameters to pass to the flows
 * @returns {Promise<Object>} - Run result with runId
 */
export async function runTestSuite(suiteId, { flowIds = [], parameters = {} } = {}) {
  const body = {};

  if (flowIds.length > 0) {
    body.flowIds = flowIds;
  }

  if (Object.keys(parameters).length > 0) {
    body.parameters = parameters;
  }

  return apiRequest(`/test-suites/${suiteId}/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Run a single test flow
 * @param {string} flowId - Flow ID to run
 * @param {string} suiteId - Test suite ID containing the flow
 * @param {Object} options - Run options
 * @param {Object} options.parameters - Parameters to pass to the flow
 * @returns {Promise<Object>} - Run result with testSuiteRunId
 */
export async function runTestFlow(flowId, suiteId, { parameters = {} } = {}) {
  const body = {
    flows: [flowId],
    inlineParameterOverride: true,
    sharedFlowVersionOverrides: [],
  };

  if (Object.keys(parameters).length > 0) {
    body.overrideParameters = parameters;
  }

  return apiRequest(`/test-suites/${suiteId}/run?ui=true`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Get the status of a test run
 * @param {string} testRunId - Test run ID
 * @returns {Promise<Object>} - Test run status
 */
export async function getTestRunStatus(testRunId) {
  return apiRequest(`/test-suites-runs/${testRunId}`);
}

/**
 * Get the status of a flow run
 * @param {string} flowRunId - Flow run ID
 * @returns {Promise<Object>} - Flow run status
 */
export async function getFlowRunStatus(flowRunId) {
  return apiRequest(`/test-flows-runs/${flowRunId}`);
}

/**
 * Get AI-generated explanation for a failed test run
 * @param {string} testRunId - The flow run ID (from testSuiteFlowRuns[].id)
 * @returns {Promise<Object>} - Explanation with reason, suggestion, etc.
 */
export async function explainFailure(testRunId) {
  return apiRequest(`/explain-failures`, {
    method: "POST",
    body: JSON.stringify({
      testRunId,
      testRunType: "flowRun"
    }),
  });
}
