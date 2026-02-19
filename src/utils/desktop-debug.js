const BRIDGE_KEY = "__DROID_DESKTOP_DEBUG_LOG_EVENT";

/**
 * Emit a structured debug event to the desktop app logger bridge when available.
 * No-op in CLI or when desktop debug logging is disabled.
 *
 * @param {string} event
 * @param {"execution"|"design"|"device"} scope
 * @param {object} ids
 * @param {object} data
 */
export function emitDesktopDebug(event, scope, ids = {}, data = {}) {
  const bridge = globalThis?.[BRIDGE_KEY];
  if (typeof bridge !== "function") {
    return;
  }

  try {
    bridge({ event, scope, ids, data });
  } catch {
    // Never allow debug logging to impact runtime behavior.
  }
}

/**
 * Truncate long strings for compact debug logs.
 *
 * @param {string} value
 * @param {number} maxLen
 * @returns {string}
 */
export function truncateForDebug(value, maxLen = 800) {
  if (typeof value !== "string") return String(value);
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}...<truncated:${value.length - maxLen}>`;
}
