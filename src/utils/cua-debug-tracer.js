import crypto from "crypto";
import { emitDesktopDebug, truncateForDebug } from "./desktop-debug.js";

function safeHeadersSnapshot(headers) {
  if (!headers || typeof headers !== "object") return {};
  const keys = [
    "x-request-id",
    "request-id",
    "openai-processing-ms",
    "retry-after",
    "x-ratelimit-limit-requests",
    "x-ratelimit-remaining-requests",
    "x-ratelimit-reset-requests",
    "x-ratelimit-limit-tokens",
    "x-ratelimit-remaining-tokens",
    "x-ratelimit-reset-tokens"
  ];

  const out = {};
  for (const key of keys) {
    const value = headers[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function summarizeContent(content) {
  if (typeof content === "string") {
    return truncateForDebug(content, 1600);
  }

  if (Array.isArray(content)) {
    const textParts = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") return part.text;
        return "";
      })
      .filter(Boolean);
    return truncateForDebug(textParts.join("\n"), 1600);
  }

  if (content && typeof content === "object") {
    return truncateForDebug(JSON.stringify(content), 1600);
  }

  return "";
}

function summarizeRequestInput(input) {
  return input.map((item) => {
    if (item?.role) {
      return {
        role: item.role,
        contentLength: typeof item.content === "string" ? item.content.length : undefined,
        content: summarizeContent(item.content)
      };
    }

    if (item?.type === "computer_call_output") {
      const imageUrl = item.output?.image_url;
      const base64Data = typeof imageUrl === "string" ? imageUrl.replace("data:image/png;base64,", "") : "";
      return {
        type: "computer_call_output",
        callId: item.call_id,
        screenshotBytes: base64Data.length,
        hasSafetyChecks: Array.isArray(item.acknowledged_safety_checks) && item.acknowledged_safety_checks.length > 0
      };
    }

    return {
      type: item?.type || "unknown"
    };
  });
}

function redactRequestForFileLog(requestParams) {
  return {
    ...requestParams,
    input: requestParams.input.map((item) => {
      if (item.type === "computer_call_output" && item.output?.image_url) {
        const imageUrl = item.output.image_url;
        const base64Data = imageUrl.replace("data:image/png;base64,", "");
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
}

function summarizeResponseOutput(response) {
  const output = response.output || [];
  return output.map((item) => {
    if (item.type === "reasoning") {
      const summaries = Array.isArray(item.summary)
        ? item.summary
            .filter((entry) => entry.type === "summary_text")
            .map((entry) => truncateForDebug(entry.text, 300))
        : [];
      return { type: "reasoning", id: item.id, summaries };
    }

    if (item.type === "message") {
      const text = Array.isArray(item.content)
        ? item.content
            .filter((entry) => entry.type === "output_text")
            .map((entry) => truncateForDebug(entry.text, 500))
            .join("\n")
        : "";
      return { type: "message", id: item.id, text };
    }

    if (item.type === "computer_call") {
      return {
        type: "computer_call",
        id: item.id,
        callId: item.call_id,
        actionType: item.action?.type
      };
    }

    if (item.type === "pending_safety_check") {
      return { type: "pending_safety_check", id: item.id, code: item.code };
    }

    return { type: item.type, id: item.id };
  });
}

function extractResponseTexts(response) {
  return (response.output || [])
    .flatMap((item) => {
      if (item.type === "reasoning" && Array.isArray(item.summary)) {
        return item.summary
          .filter((entry) => entry.type === "summary_text")
          .map((entry) => truncateForDebug(entry.text, 500));
      }
      if (item.type === "message" && Array.isArray(item.content)) {
        return item.content
          .filter((entry) => entry.type === "output_text")
          .map((entry) => truncateForDebug(entry.text, 1000));
      }
      return [];
    })
    .filter(Boolean);
}

export class CuaDebugTracer {
  constructor(logger) {
    this.logger = logger;
    this.lastPendingSafetyChecksByChain = new Map();
    this.lastResponseMetaByChain = new Map();
  }

  startTurn({ requestParams, input, screenshotBase64, deviceInfo, debugContext, previousResponseId }) {
    const scope = debugContext?.scope === "execution" || debugContext?.scope === "design" ? debugContext.scope : "execution";
    const ids = {
      ...(scope === "execution" ? { runId: debugContext?.runId } : {}),
      ...(scope === "design" ? { sessionId: debugContext?.sessionId } : {}),
      ...(debugContext?.stepId ? { stepId: debugContext.stepId } : {}),
      ...(Number.isInteger(debugContext?.instructionIndex) ? { instructionIndex: debugContext.instructionIndex } : {})
    };

    const chainId = scope === "design" ? ids.sessionId : ids.runId;
    const chainKey = `${scope}:${chainId || "unknown"}`;
    const previousPendingSafetyChecks = Array.isArray(this.lastPendingSafetyChecksByChain.get(chainKey))
      ? this.lastPendingSafetyChecksByChain.get(chainKey)
      : [];
    const lastResponseMeta = this.lastResponseMetaByChain.get(chainKey) || null;
    const localRequestId = crypto.randomUUID();

    const requestLog = redactRequestForFileLog(requestParams);
    const messages = summarizeRequestInput(input);
    const acknowledgedSafetyChecksSent = input
      .filter((item) => item?.type === "computer_call_output")
      .flatMap((item) => {
        if (!Array.isArray(item.acknowledged_safety_checks)) return [];
        return item.acknowledged_safety_checks.map((check) => ({
          callId: item.call_id,
          id: check?.id ?? null,
          code: check?.code ?? null
        }));
      });
    const inputCallIds = input
      .filter((item) => item?.type === "computer_call_output")
      .map((item) => item.call_id)
      .filter(Boolean);
    const inputItemTypes = input.map((item) => item?.type || (item?.role ? `message:${item.role}` : "unknown"));
    const lastResponseCallIds = Array.isArray(lastResponseMeta?.computerCallIds) ? lastResponseMeta.computerCallIds : [];
    const missingCallIds = inputCallIds.filter((callId) => !lastResponseCallIds.includes(callId));
    const previousResponseIdMatchesLastResponseId =
      !previousResponseId || !lastResponseMeta?.id ? null : previousResponseId === lastResponseMeta.id;
    const allInputCallIdsFoundInLastResponse = inputCallIds.length === 0 ? true : missingCallIds.length === 0;

    const requestConfig = {
      model: requestParams.model,
      tools: requestParams.tools,
      truncation: requestParams.truncation,
      reasoning: requestParams.reasoning,
      store: requestParams.store
    };
    const requestConfigHash = crypto.createHash("sha256").update(JSON.stringify(requestConfig)).digest("hex");

    emitDesktopDebug("cua.request", scope, ids, {
      previousResponseId: previousResponseId || null,
      localRequestId,
      messageCount: input.length,
      inputItemTypes,
      inputCallIds,
      messages,
      screenshot: screenshotBase64
        ? {
            width: deviceInfo?.scaled_width ?? null,
            height: deviceInfo?.scaled_height ?? null,
            base64Length: screenshotBase64.length
          }
        : null,
      safetyChecks: {
        previousPending: previousPendingSafetyChecks,
        previousPendingCount: previousPendingSafetyChecks.length,
        acknowledgedSent: acknowledgedSafetyChecksSent,
        acknowledgedSentCount: acknowledgedSafetyChecksSent.length
      },
      chain: {
        lastResponseId: lastResponseMeta?.id ?? null,
        lastResponseOutputTypes: lastResponseMeta?.outputTypes ?? [],
        lastResponseComputerCallIds: lastResponseCallIds,
        lastResponsePendingSafetyCheckIds: lastResponseMeta?.pendingSafetyCheckIds ?? [],
        previousResponseIdMatchesLastResponseId,
        allInputCallIdsFoundInLastResponse,
        missingCallIds
      },
      requestConfigHash
    });

    emitDesktopDebug("cua.chain", scope, ids, {
      localRequestId,
      previousResponseId: previousResponseId || null,
      lastResponseId: lastResponseMeta?.id ?? null,
      previousResponseIdMatchesLastResponseId,
      inputCallIds,
      lastResponseComputerCallIds: lastResponseCallIds,
      allInputCallIdsFoundInLastResponse,
      missingCallIds,
      requestConfigHash
    });

    return {
      scope,
      ids,
      chainKey,
      localRequestId,
      requestLog,
      requestConfigHash,
      previousPendingSafetyChecks,
      acknowledgedSafetyChecksSent,
      previousResponseIdMatchesLastResponseId,
      allInputCallIdsFoundInLastResponse,
      missingCallIds,
      lastResponseMeta,
      lastResponseCallIds
    };
  }

  onResponse(trace, response) {
    const outputTypes = (response.output || []).map((item) => item.type);
    const toolCalls = (response.output || [])
      .filter((item) => item.type === "computer_call")
      .map((item) => ({
        call_id: item.call_id,
        action_type: item.action?.type
      }));
    const safetyChecks = (response.output || [])
      .filter((item) => item.type === "pending_safety_check")
      .map((item) => ({
        id: item.id,
        code: item.code,
        message: item.message
      }));

    this.lastPendingSafetyChecksByChain.set(trace.chainKey, safetyChecks);
    this.lastResponseMetaByChain.set(trace.chainKey, {
      id: response.id,
      outputTypes,
      computerCallIds: toolCalls.map((item) => item.call_id).filter(Boolean),
      pendingSafetyCheckIds: safetyChecks.map((item) => item.id).filter(Boolean)
    });

    const accountedItems = toolCalls.length + safetyChecks.length;
    const totalItems = response.output?.length || 0;
    this.logger.debug("CUA Response:", {
      id: response.id,
      output_length: totalItems,
      output_types: outputTypes,
      tool_calls: toolCalls.length > 0 ? toolCalls : "none",
      pending_safety_checks: safetyChecks.length > 0 ? safetyChecks : "none"
    });
    if (accountedItems < totalItems) {
      this.logger.debug("UNACCOUNTED OUTPUT ITEMS - Full output array:", response.output);
    }

    emitDesktopDebug("cua.response", trace.scope, trace.ids, {
      id: response.id,
      localRequestId: trace.localRequestId,
      outputCount: (response.output || []).length,
      outputTypes,
      output: summarizeResponseOutput(response),
      texts: extractResponseTexts(response),
      safetyChecks: {
        pending: safetyChecks,
        pendingCount: safetyChecks.length
      }
    });

    emitDesktopDebug("cua.response.full", trace.scope, trace.ids, {
      id: response.id,
      localRequestId: trace.localRequestId,
      response
    });
  }

  onError(trace, err) {
    this.logger.error("CUA Request failed", { request: trace.requestLog, error: err });

    emitDesktopDebug("cua.request.full", trace.scope, trace.ids, {
      localRequestId: trace.localRequestId,
      request: trace.requestLog,
      requestConfigHash: trace.requestConfigHash,
      chain: {
        lastResponseId: trace.lastResponseMeta?.id ?? null,
        lastResponseOutputTypes: trace.lastResponseMeta?.outputTypes ?? [],
        lastResponseComputerCallIds: trace.lastResponseCallIds,
        lastResponsePendingSafetyCheckIds: trace.lastResponseMeta?.pendingSafetyCheckIds ?? [],
        previousResponseIdMatchesLastResponseId: trace.previousResponseIdMatchesLastResponseId,
        allInputCallIdsFoundInLastResponse: trace.allInputCallIdsFoundInLastResponse,
        missingCallIds: trace.missingCallIds
      },
      safetyChecks: {
        previousPending: trace.previousPendingSafetyChecks,
        previousPendingCount: trace.previousPendingSafetyChecks.length,
        acknowledgedSent: trace.acknowledgedSafetyChecksSent,
        acknowledgedSentCount: trace.acknowledgedSafetyChecksSent.length
      }
    });

    const responseError = err?.error && typeof err.error === "object" ? err.error : null;
    const requestIdFromHeaders =
      err?.headers && typeof err.headers === "object"
        ? err.headers["x-request-id"] || err.headers["request-id"] || null
        : null;
    const requestId = err?.request_id || responseError?.request_id || requestIdFromHeaders || null;
    const headers = safeHeadersSnapshot(err?.headers);

    emitDesktopDebug("device.error", "device", trace.ids, {
      localRequestId: trace.localRequestId,
      operation: "cua.request",
      message: err?.message || String(err),
      status: err?.status ?? null,
      name: err?.name ?? null,
      code: err?.code ?? responseError?.code ?? null,
      type: responseError?.type ?? null,
      param: responseError?.param ?? null,
      requestId,
      headers,
      chain: {
        lastResponseId: trace.lastResponseMeta?.id ?? null,
        lastResponseOutputTypes: trace.lastResponseMeta?.outputTypes ?? [],
        lastResponseComputerCallIds: trace.lastResponseCallIds,
        lastResponsePendingSafetyCheckIds: trace.lastResponseMeta?.pendingSafetyCheckIds ?? [],
        previousResponseIdMatchesLastResponseId: trace.previousResponseIdMatchesLastResponseId,
        allInputCallIdsFoundInLastResponse: trace.allInputCallIdsFoundInLastResponse,
        missingCallIds: trace.missingCallIds
      },
      requestConfigHash: trace.requestConfigHash,
      details: responseError,
      safetyChecks: {
        previousPending: trace.previousPendingSafetyChecks,
        previousPendingCount: trace.previousPendingSafetyChecks.length,
        acknowledgedSent: trace.acknowledgedSafetyChecksSent,
        acknowledgedSentCount: trace.acknowledgedSafetyChecksSent.length
      }
    });
  }
}
