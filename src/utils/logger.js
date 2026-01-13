import { appendFileSync, writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';

/**
 * Simple logger that writes to a file when debug mode is enabled
 */
class Logger {
  constructor() {
    this.debugMode = false;
    this.logFile = null;
  }

  /**
   * Initialize debug logging to a file
   * @param {boolean} enabled - Whether debug logging is enabled
   */
  async init(enabled = false) {
    this.debugMode = enabled;

    if (enabled) {
      const logsDir = path.join(process.cwd(), 'logs');
      await mkdir(logsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      this.logFile = path.join(logsDir, `debug-${timestamp}.log`);

      // Create/clear the log file
      writeFileSync(this.logFile, `Debug log started at ${new Date().toISOString()}\n\n`);
      console.log(`Debug logging enabled: ${this.logFile}`);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {*} data - Optional data to log (will be JSON stringified)
   */
  debug(message, data = null) {
    if (!this.debugMode || !this.logFile) return;

    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] ${message}\n`;

    if (data !== null) {
      if (typeof data === 'object') {
        logEntry += JSON.stringify(data, null, 2) + '\n';
      } else {
        logEntry += String(data) + '\n';
      }
    }

    logEntry += '\n';

    try {
      appendFileSync(this.logFile, logEntry);
    } catch (err) {
      console.error('Failed to write to log file:', err.message);
    }
  }

  /**
   * Log an error
   * @param {string} message - The error message
   * @param {Error|*} error - The error object or data
   */
  error(message, error = null) {
    if (!this.debugMode || !this.logFile) return;

    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] ERROR: ${message}\n`;

    if (error) {
      if (error instanceof Error) {
        logEntry += `  Message: ${error.message}\n`;
        logEntry += `  Stack: ${error.stack}\n`;
      } else if (typeof error === 'object') {
        logEntry += JSON.stringify(error, null, 2) + '\n';
      } else {
        logEntry += String(error) + '\n';
      }
    }

    logEntry += '\n';

    try {
      appendFileSync(this.logFile, logEntry);
    } catch (err) {
      console.error('Failed to write to log file:', err.message);
    }
  }
}

// Global singleton instance
export const logger = new Logger();
